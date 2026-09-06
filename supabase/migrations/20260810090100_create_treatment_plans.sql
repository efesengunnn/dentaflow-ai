-- Sprint 28: Treatment Plan redesign (2/7) — treatment_plans is the
-- sale/agreement layer, replacing treatment_series as the commercial unit.
-- Unlike treatment_series, a plan can carry multiple treatment_plan_items
-- (multi-procedure, multi-provider) instead of a single flat
-- treatment_type/fee pair.
--
-- total_amount/paid_amount/remaining_amount are deliberately NOT stored
-- columns — total_amount is always SUM(treatment_plan_items.total_price),
-- paid_amount is the same signed-ledger-sum the legacy series already uses,
-- remaining_amount is total_amount - paid_amount. Storing any of these
-- would create a second source of truth that must be kept in sync across
-- item revision, session correction, and payment recording — exactly what
-- the append-only ledger pattern below exists to avoid. See
-- docs/DATABASE.md.
--
-- status reuses the existing treatment_lifecycle_status enum (active |
-- completed | cancelled | voided) rather than a new type, for parity with
-- the legacy series/treatment cancelled-vs-voided distinction.
--
-- legacy_series_id is migration traceability only (populated by the
-- one-time backfill, migration 7/7) — it is never written to by the
-- application after cutover.

create table public.treatment_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  plan_name text not null,
  currency text not null default 'TRY',
  status public.treatment_lifecycle_status not null default 'active',
  legacy_series_id uuid unique references public.treatment_series (id),
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.treatment_plans is
  'The sale/agreement layer for one or more treatment_plan_items — replaces '
  'treatment_series as of Sprint 28. total_amount/paid_amount/'
  'remaining_amount are never stored, always derived from '
  'treatment_plan_items + treatment_payments at query time. See '
  'docs/DATABASE.md#treatment-plans.';

create index treatment_plans_clinic_id_idx on public.treatment_plans (clinic_id);
create index treatment_plans_clinic_patient_idx on public.treatment_plans (clinic_id, patient_id);
create index treatment_plans_clinic_status_idx on public.treatment_plans (clinic_id, status);

create trigger treatment_plans_set_audit_columns
  before insert or update on public.treatment_plans
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security — same mechanism and Tier-1 reasoning as
-- treatment_series (see docs/DATABASE.md and docs/ARCHITECTURE.md's AI Data
-- Access section): a plan's own amounts stay readable by all clinical/
-- front-desk roles, clinic-wide aggregation is gated at the query layer via
-- current_staff_has_permission('financial_access'). Secretary may now
-- INSERT (create a plan) — widened vs. the legacy series policy, per
-- founder decision (Sprint 28) — but not UPDATE (revise); revision stays
-- owner/doctor/beauty_specialist only. No DELETE grant anywhere — a plan is
-- never deleted, only cancelled/voided.
-- ---------------------------------------------------------------------------
alter table public.treatment_plans enable row level security;

grant select, insert, update on public.treatment_plans to authenticated;

create policy treatment_plans_select_own_clinic on public.treatment_plans
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_plans_insert_clinical_and_front_desk on public.treatment_plans
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

create policy treatment_plans_update_clinical_roles on public.treatment_plans
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

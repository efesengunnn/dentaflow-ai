-- Sprint 28: Treatment Plan redesign (3/7) — treatment_plan_items is the
-- new layer that did not exist in the legacy model: what is actually being
-- sold within a plan. A multi-procedure plan (e.g. "PRP + Botoks") is one
-- treatment_plans row with two treatment_plan_items rows; a multi-provider
-- plan is represented by items with different provider_id values (one
-- provider per item, not a split within a single item).
--
-- treatment_name stays free text, matching treatment_series.treatment_type
-- (no vertical-specific closed enum, per docs/PRODUCT_BLUEPRINT.md Section
-- 7). catalog_item_id is an optional soft link to the existing per-staff
-- picklist (staff_treatment_catalog_items) purely to prefill the form —
-- deactivating/renaming a catalog item must never retroactively change a
-- historical plan item, so this is deliberately not a hard dependency.
--
-- completed_sessions/cancelled_sessions are deliberately NOT stored —
-- computed via COUNT() over treatment_sessions at query time, same
-- precedent as treatment_series today (no denormalized counter to keep in
-- sync across correction/void).
--
-- provider_share_amount represents per-item revenue ATTRIBUTION (which
-- provider generated how much of the clinic's revenue) — explicitly not a
-- commission/payout figure (founder decision, Sprint 28). Visible to owner
-- only, not even to the provider themself — see the query-layer
-- field-visibility contract in docs/DATABASE.md. When null, the item's
-- full total_price is attributed to its single provider_id (the common
-- case); an explicit value overrides that default only when the owner
-- needs to record a different split.
--
-- revision_no increments on every structural UPDATE (session_count,
-- provider_id, unit_price) — see lib/treatment-plans/actions.ts.

create table public.treatment_plan_items (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  treatment_plan_id uuid not null references public.treatment_plans (id),
  provider_id uuid not null references public.staff_members (id),
  treatment_name text not null,
  catalog_item_id uuid references public.staff_treatment_catalog_items (id),
  session_count integer not null default 1,
  unit_price numeric(12, 2),
  total_price numeric(12, 2),
  provider_share_amount numeric(12, 2),
  status public.treatment_lifecycle_status not null default 'active',
  revision_no integer not null default 1,
  legacy_series_id uuid references public.treatment_series (id),
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_plan_items_session_count_positive check (session_count > 0),
  constraint treatment_plan_items_unit_price_non_negative check (unit_price is null or unit_price >= 0),
  constraint treatment_plan_items_total_price_non_negative check (total_price is null or total_price >= 0),
  constraint treatment_plan_items_provider_share_amount_non_negative check (
    provider_share_amount is null or provider_share_amount >= 0
  ),
  constraint treatment_plan_items_revision_no_positive check (revision_no > 0)
);

comment on table public.treatment_plan_items is
  'One treatment line item within a treatment_plans row — one provider, one '
  'treatment, a session count and price. Multi-procedure/multi-provider '
  'plans are multiple items under the same plan. provider_share_amount is '
  'revenue attribution, owner-visible only, defaults to total_price when '
  'null. See docs/DATABASE.md#treatment-plan-items.';

create index treatment_plan_items_clinic_id_idx on public.treatment_plan_items (clinic_id);
create index treatment_plan_items_clinic_patient_idx on public.treatment_plan_items (clinic_id, patient_id);
create index treatment_plan_items_treatment_plan_id_idx on public.treatment_plan_items (treatment_plan_id);
create index treatment_plan_items_provider_id_idx on public.treatment_plan_items (provider_id);
create index treatment_plan_items_clinic_status_idx on public.treatment_plan_items (clinic_id, status);

create trigger treatment_plan_items_set_audit_columns
  before insert or update on public.treatment_plan_items
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security — identical shape to treatment_plans: secretary may
-- INSERT (create items as part of plan creation), only owner/doctor/
-- beauty_specialist may UPDATE (revise). No DELETE grant — a wrongly added
-- item is voided, never removed.
-- ---------------------------------------------------------------------------
alter table public.treatment_plan_items enable row level security;

grant select, insert, update on public.treatment_plan_items to authenticated;

create policy treatment_plan_items_select_own_clinic on public.treatment_plan_items
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_plan_items_insert_clinical_and_front_desk on public.treatment_plan_items
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

create policy treatment_plan_items_update_clinical_roles on public.treatment_plan_items
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

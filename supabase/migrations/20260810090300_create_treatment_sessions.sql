-- Sprint 28: Treatment Plan redesign (4/7) — treatment_sessions is the
-- realized-visit layer, replacing treatments as of this sprint. A row is
-- only ever created at the moment a visit is actually performed —
-- appointments already own the "scheduled but not yet happened" state, so
-- unlike legacy treatments there is no "active"/planned status here.
--
-- Correction/void state machine (status: completed | corrected | voided):
--   completed -> corrected: the original row is marked corrected
--     (corrected_by/at/reason set, replaced_by_session_id points at a new
--     row) and never updated again; the new row is a fresh completed
--     session with the same session_number. This is the exact extension of
--     the append-only treatment_payments correction pattern
--     (related_payment_id) already in production — supersede, never
--     silently rewrite.
--   completed -> voided: the row is marked voided in place
--     (corrected_by/at/reason set, replaced_by_session_id stays null) — no
--     replacement row, this visit never should have counted.
--   corrected/voided are terminal — enforced by the application layer
--     (no DB trigger for the transition itself, per this project's
--     no-DB-triggers-for-status-transitions convention), the CHECK
--     constraint below only enforces internal consistency of each state's
--     required fields.
--
-- unit_price_snapshot captures the plan item's unit_price at the moment
-- this session was performed — without it, a later price revision
-- (treatment_plan_items.revision_no) would silently re-price historical
-- sessions when reporting sums them.
--
-- No updated_by column (unlike every other audited table in this schema):
-- "who last touched this row" is already captured precisely by
-- corrected_by for the one kind of update this table allows. A small
-- dedicated trigger (not the shared set_audit_columns, which requires
-- updated_by) keeps updated_at current instead.

create table public.treatment_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  treatment_plan_item_id uuid not null references public.treatment_plan_items (id),
  appointment_id uuid references public.appointments (id),
  session_number integer not null,
  performed_by uuid not null references public.staff_members (id),
  performed_at date not null,
  control_date date,
  notes text,
  unit_price_snapshot numeric(12, 2),
  status public.treatment_session_status not null default 'completed',
  corrected_by uuid references public.staff_members (id),
  corrected_at timestamptz,
  correction_reason text,
  replaced_by_session_id uuid references public.treatment_sessions (id),
  legacy_treatment_id uuid unique references public.treatments (id),
  created_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_sessions_session_number_positive check (session_number > 0),
  constraint treatment_sessions_unit_price_snapshot_non_negative check (
    unit_price_snapshot is null or unit_price_snapshot >= 0
  ),
  constraint treatment_sessions_state_machine_consistent check (
    (
      status = 'completed'
      and corrected_by is null and corrected_at is null
      and correction_reason is null and replaced_by_session_id is null
    )
    or (
      status = 'corrected'
      and corrected_by is not null and corrected_at is not null
      and correction_reason is not null and replaced_by_session_id is not null
    )
    or (
      status = 'voided'
      and corrected_by is not null and corrected_at is not null
      and correction_reason is not null and replaced_by_session_id is null
    )
  )
);

comment on table public.treatment_sessions is
  'One row per realized (performed) treatment visit — replaces treatments '
  'as of Sprint 28. Only ever created at completion time; "scheduled but '
  'not yet happened" is owned entirely by appointments. A realized session '
  'is never silently rewritten — see the state machine above and the '
  'column-level grants below. See docs/DATABASE.md#treatment-sessions.';

create index treatment_sessions_clinic_id_idx on public.treatment_sessions (clinic_id);
create index treatment_sessions_clinic_patient_idx on public.treatment_sessions (clinic_id, patient_id);
create index treatment_sessions_treatment_plan_item_id_idx on public.treatment_sessions (treatment_plan_item_id);
create index treatment_sessions_appointment_id_idx on public.treatment_sessions (appointment_id);
create index treatment_sessions_performed_by_performed_at_idx on public.treatment_sessions (performed_by, performed_at);
create index treatment_sessions_clinic_status_idx on public.treatment_sessions (clinic_id, status);
create index treatment_sessions_clinic_control_date_idx on public.treatment_sessions (clinic_id, control_date);
create index treatment_sessions_replaced_by_session_id_idx on public.treatment_sessions (replaced_by_session_id);

create function public.treatment_sessions_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger treatment_sessions_set_updated_at
  before update on public.treatment_sessions
  for each row execute function public.treatment_sessions_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security. INSERT is open to all clinical + front-desk roles
-- (a session is completed by whoever is at the front desk or performing
-- the procedure). UPDATE is restricted to the correction/void case, with a
-- per-actor rule enforced directly in the policy:
--   owner            -> any session, any age
--   doctor/beauty_sp -> only their own performed_by session
--   secretary        -> any session, but only within 24 hours of created_at
-- No DELETE grant at all — a realized session is never removed, only
-- corrected or voided (founder's core rule for this sprint).
--
-- Column-level grants additionally lock down which fields UPDATE can ever
-- touch, regardless of the RLS policy passing: performed_by, performed_at,
-- session_number and notes become physically un-updatable by any
-- authenticated role once inserted. This extends the treatment_payments
-- precedent (zero UPDATE/DELETE grant at all) — a session needs some
-- mutability for its correction pointer fields, so a full lockout isn't
-- right, but the same philosophy applies.
-- ---------------------------------------------------------------------------
alter table public.treatment_sessions enable row level security;

grant select, insert on public.treatment_sessions to authenticated;
grant update (status, corrected_by, corrected_at, correction_reason, replaced_by_session_id, updated_at)
  on public.treatment_sessions to authenticated;

create policy treatment_sessions_select_own_clinic on public.treatment_sessions
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_sessions_insert_clinical_and_front_desk on public.treatment_sessions
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

create policy treatment_sessions_update_correction_rules on public.treatment_sessions
  for update
  using (
    clinic_id = public.current_clinic_id()
    and (
      public.current_staff_role() = 'owner'
      or (public.current_staff_role() in ('doctor', 'beauty_specialist') and performed_by = auth.uid())
      or (public.current_staff_role() = 'secretary' and now() - created_at < interval '24 hours')
    )
  )
  with check (clinic_id = public.current_clinic_id());

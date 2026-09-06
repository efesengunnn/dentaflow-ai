-- Sprint 6: Appointment Management (Foundation) — third real business module.
-- Schema reconciliation vs. docs/DATABASE.md's original `appointments` design
-- (see docs/CHANGELOG.md Sprint 6 entry for the full reasoning):
--   - `rescheduled` status dropped: a reschedule is a plain edit to
--     starts_at/ends_at via the normal Edit flow, not a distinct terminal
--     status on the original row (docs/DATABASE.md Risk #10 left this
--     undecided; Sprint 6 resolves it this way).
--   - `notes` column dropped in favor of `appointment_activities` as the
--     single source of truth for narrative history — same reconciliation
--     already made for leads (Sprint 3) and patients (Sprint 4).
--   - `appointment_activities` added: not in the original design, but
--     `lead_activities`'s Sprint 3 notes already anticipated this ("if
--     appointments... need this same activity-feed shape later, generalizing
--     is a contained migration, not a redesign") — still one table per
--     entity, not a polymorphic `activities` table (docs/PRODUCT_BLUEPRINT.md
--     Open Question #5 stays open).
--   - `status = 'cancelled'` vs `deleted_at`: same distinct-concepts split as
--     leads' `lost` vs `deleted_at` — cancelled is a real, informative
--     outcome (the patient isn't coming), deleted_at is for a mistaken/
--     duplicate/test entry that was never a real appointment.

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create table public.appointments (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  staff_id uuid not null references public.staff_members (id),
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  deleted_at timestamptz,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_ends_after_starts check (ends_at > starts_at)
);

comment on table public.appointments is
  'Patient appointment booking. staff_id is the assigned provider (typically '
  'the doctor) — see docs/DATABASE.md#appointments. deleted_at is a mistaken/'
  'duplicate entry, distinct from status=''cancelled'' (a real booking the '
  'patient/clinic cancelled). Overlap prevention (same staff_id, same clinic, '
  'time-range intersection) is enforced in the application layer '
  '(lib/appointments/actions.ts), not a DB exclusion constraint — avoids a '
  'btree_gist extension dependency for a pilot-scale clinic.';
comment on column public.appointments.deleted_at is
  'Soft delete marker — distinct from status=''cancelled''. Never hard-deleted.';

create index appointments_clinic_id_idx on public.appointments (clinic_id);
create index appointments_clinic_starts_at_idx on public.appointments (clinic_id, starts_at);
create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_staff_id_starts_at_idx on public.appointments (staff_id, starts_at);

-- ---------------------------------------------------------------------------
-- appointment_activities — append-only activity/notes timeline, same shape
-- and reasoning as lead_activities (Sprint 3) / patient_activities (Sprint
-- 4). status_changed exists here (unlike patient_activities) because
-- appointments have a status pipeline, same as leads.
-- ---------------------------------------------------------------------------
create type public.appointment_activity_type as enum (
  'appointment_created',
  'appointment_updated',
  'status_changed',
  'note_added',
  'appointment_deleted'
);

create table public.appointment_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  appointment_id uuid not null references public.appointments (id),
  activity_type public.appointment_activity_type not null,
  description text not null,
  metadata jsonb,
  created_by uuid references public.staff_members (id),
  created_at timestamptz not null default now()
);

comment on table public.appointment_activities is
  'Append-only activity/notes timeline for an appointment — the single '
  'source of truth for appointment notes (no appointments.notes column '
  'exists). See docs/DATABASE.md#appointment_activities.';

create index appointment_activities_appointment_id_created_at_idx
  on public.appointment_activities (appointment_id, created_at desc);

create trigger appointments_set_audit_columns
  before insert or update on public.appointments
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security — default-deny, same mechanism as leads/patients. RBAC
-- differs deliberately from leads/patients here: docs/DATABASE.md's
-- appointments row grants INSERT/UPDATE to *all* roles (a Secretary books/
-- edits; a Doctor may adjust their own), not just owner/secretary — booking
-- an appointment is not a front-desk-only responsibility the way lead/
-- patient record management is. appointment_activities' INSERT policy
-- matches that same all-roles access. Neither table has an UPDATE/DELETE
-- policy on the activities side — immutable log, enforced by default-deny.
-- ---------------------------------------------------------------------------
alter table public.appointments enable row level security;
alter table public.appointment_activities enable row level security;

grant select, insert, update on public.appointments to authenticated;
grant select, insert on public.appointment_activities to authenticated;

create policy appointments_select_own_clinic on public.appointments
  for select
  using (clinic_id = public.current_clinic_id());

create policy appointments_insert_own_clinic on public.appointments
  for insert
  with check (clinic_id = public.current_clinic_id());

create policy appointments_update_own_clinic on public.appointments
  for update
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

create policy appointment_activities_select_own_clinic on public.appointment_activities
  for select
  using (clinic_id = public.current_clinic_id());

create policy appointment_activities_insert_own_clinic on public.appointment_activities
  for insert
  with check (clinic_id = public.current_clinic_id());

-- Sprint 34: One appointment, multiple treatments. Until now an appointment
-- linked to at most ONE treatment_plan_item (appointments.treatment_plan_item_id).
-- A real visit often covers several procedures at the same time (e.g. Dolgu +
-- Kanal at 16:00, same dentist), so this junction lets one appointment carry
-- many plan items. The legacy appointments.treatment_plan_id/item_id columns
-- are kept and set to the FIRST linked item for backward-compatible readers;
-- this table is the source of truth for the full set.
--
-- One appointment is still a single provider + single time slot (the app
-- constrains the multi-select to items of one provider), so no provider column
-- is needed here — each item keeps its own provider via treatment_plan_items.

create table public.appointment_treatment_plan_items (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  appointment_id uuid not null references public.appointments (id),
  treatment_plan_item_id uuid not null references public.treatment_plan_items (id),
  created_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  constraint appointment_treatment_plan_items_unique unique (appointment_id, treatment_plan_item_id)
);

comment on table public.appointment_treatment_plan_items is
  'Junction: the treatment_plan_items a single appointment covers (Sprint 34, '
  'one appointment / multiple treatments). appointments.treatment_plan_item_id '
  'still mirrors the first item for legacy readers.';

create index appointment_treatment_plan_items_clinic_id_idx on public.appointment_treatment_plan_items (clinic_id);
create index appointment_treatment_plan_items_appointment_id_idx on public.appointment_treatment_plan_items (appointment_id);
create index appointment_treatment_plan_items_item_id_idx on public.appointment_treatment_plan_items (treatment_plan_item_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security — clinic-scoped, identical shape to `appointments` (which
-- gates the whole row by clinic_id, no per-role check): any authenticated
-- clinic member who can book/edit an appointment can link/unlink its items.
-- ---------------------------------------------------------------------------
alter table public.appointment_treatment_plan_items enable row level security;

grant select, insert, delete on public.appointment_treatment_plan_items to authenticated;

create policy appointment_treatment_plan_items_select_own_clinic on public.appointment_treatment_plan_items
  for select
  using (clinic_id = public.current_clinic_id());

create policy appointment_treatment_plan_items_insert_own_clinic on public.appointment_treatment_plan_items
  for insert
  with check (clinic_id = public.current_clinic_id());

create policy appointment_treatment_plan_items_delete_own_clinic on public.appointment_treatment_plan_items
  for delete
  using (clinic_id = public.current_clinic_id());

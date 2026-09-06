-- Sprint 28C: appointments gains nullable references to the new
-- treatment_plans/treatment_plan_items tables, alongside (not replacing)
-- the existing treatments.appointment_id back-reference from the legacy
-- module. Booking an appointment against a plan/item only sets these two
-- columns — it does NOT create a treatment_sessions row (that stays a
-- separate, later "seansı tamamla" action, deliberately out of scope here).
--
-- No RLS/grant changes needed: appointments' existing SELECT/INSERT/UPDATE
-- policies already govern the whole row by clinic_id, and these are plain
-- nullable columns with no independent access-control meaning of their own.

alter table public.appointments
  add column treatment_plan_id uuid references public.treatment_plans (id),
  add column treatment_plan_item_id uuid references public.treatment_plan_items (id);

comment on column public.appointments.treatment_plan_id is
  'Set when this appointment continues or starts a Sprint 28 Tedavi Planı — '
  'the sibling of the legacy treatments.appointment_id back-reference, '
  'pointing the other direction (appointment -> plan, not treatment -> '
  'appointment). No treatment_sessions row is created at booking time.';
comment on column public.appointments.treatment_plan_item_id is
  'The specific treatment_plan_items row this appointment is for, within '
  'treatment_plan_id — required whenever treatment_plan_id is set.';

create index appointments_treatment_plan_id_idx on public.appointments (treatment_plan_id);
create index appointments_treatment_plan_item_id_idx on public.appointments (treatment_plan_item_id);

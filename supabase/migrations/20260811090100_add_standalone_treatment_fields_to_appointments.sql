-- Sprint 30.3: Simplified Appointment Flow — "Tek Seans / Tek İşlem" branch
-- of the appointment-creation flow deliberately does not create a
-- treatment_plans/treatment_plan_items row (founder decision: package sales
-- and single ad-hoc sessions are separate flows, never silently merged).
-- treatment_plan_id/treatment_plan_item_id stay null in that case, so the
-- treatment name, price and control date this branch still collects need
-- their own home directly on the appointment row — the AI follow-up system
-- needs treatment name + provider (staff_id, already present) + control
-- date to be queryable even when no plan exists.

alter table public.appointments
  add column standalone_treatment_name text,
  add column standalone_price numeric(12, 2),
  add column control_date date;

comment on column public.appointments.standalone_treatment_name is
  'Treatment name for a "Tek Seans / Tek İşlem" appointment not linked to '
  'any treatment_plan_item — null whenever treatment_plan_item_id is set.';
comment on column public.appointments.standalone_price is
  'Price for a standalone single-session appointment — null whenever '
  'treatment_plan_item_id is set (pricing lives on the plan item instead).';
comment on column public.appointments.control_date is
  'Planned follow-up date for a standalone single-session appointment '
  '(optional) — the sibling of treatment_plan_items.control_date for the '
  'no-plan case. Feeds the same AI follow-up queries.';

alter table public.appointments
  add constraint appointments_standalone_price_non_negative check (
    standalone_price is null or standalone_price >= 0
  );

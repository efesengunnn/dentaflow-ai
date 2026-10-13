-- Founder decision 2026-10-13: deleting a patient takes their treatment plans
-- with them — they must not linger in the clinic-wide "Tedavi Planları" list
-- or its totals.
--
-- A database trigger, not app code: plan/item updates are RLS-limited to
-- clinical roles while patient deletion is not, and the audit trigger
-- (set_audit_columns) forces updated_by := auth.uid(), so a service-role
-- cascade would violate updated_by NOT NULL. Running inside the deleting
-- user's own statement keeps auth.uid() set, makes the cascade atomic with
-- the patient delete, and works for every role allowed to delete a patient.

create function public.cascade_patient_soft_delete_to_treatment_plans()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.treatment_plan_items
  set deleted_at = new.deleted_at,
      deleted_by = new.updated_by,
      delete_reason = 'Hasta kaydı silindiği için otomatik silindi.'
  where patient_id = new.id
    and deleted_at is null;

  update public.treatment_plans
  set deleted_at = new.deleted_at,
      deleted_by = new.updated_by,
      delete_reason = 'Hasta kaydı silindiği için otomatik silindi.'
  where patient_id = new.id
    and deleted_at is null;

  return null;
end;
$$;

create trigger patients_cascade_soft_delete_to_treatment_plans
  after update of deleted_at on public.patients
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.cascade_patient_soft_delete_to_treatment_plans();

-- Backfill: patients deleted before this shipped left their plans active.
-- Attributed to whoever deleted the patient (patients.updated_by, set in the
-- same update). The audit triggers are paused for these two statements only
-- because auth.uid() is null in a migration and would null out updated_by.

alter table public.treatment_plan_items disable trigger treatment_plan_items_set_audit_columns;
alter table public.treatment_plans disable trigger treatment_plans_set_audit_columns;

update public.treatment_plan_items as item
set deleted_at = patient.deleted_at,
    deleted_by = patient.updated_by,
    delete_reason = 'Hasta kaydı silindiği için otomatik silindi.',
    updated_by = patient.updated_by,
    updated_at = now()
from public.patients as patient
where item.patient_id = patient.id
  and patient.deleted_at is not null
  and item.deleted_at is null;

update public.treatment_plans as plan
set deleted_at = patient.deleted_at,
    deleted_by = patient.updated_by,
    delete_reason = 'Hasta kaydı silindiği için otomatik silindi.',
    updated_by = patient.updated_by,
    updated_at = now()
from public.patients as patient
where plan.patient_id = patient.id
  and patient.deleted_at is not null
  and plan.deleted_at is null;

alter table public.treatment_plan_items enable trigger treatment_plan_items_set_audit_columns;
alter table public.treatment_plans enable trigger treatment_plans_set_audit_columns;

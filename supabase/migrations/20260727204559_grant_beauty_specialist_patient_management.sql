-- Founder decision (2026-07-27, live end-to-end test): beauty_specialist now
-- has the same patient-management permissions as secretary. Sprint 4 scoped
-- patient create/update (soft-delete is an update) to owner/secretary only;
-- beauty_specialist was never added to that set when the role was introduced
-- in Sprint 7. Surfaced by a real test invite (Havva Şeker, beauty_specialist)
-- whose patient-create attempts were rejected by RLS — masked by the
-- application's generic "duplicate phone" error message, not a real
-- duplicate.

alter policy patients_insert_owner_or_secretary on public.patients
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  );

alter policy patients_update_owner_or_secretary on public.patients
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

alter policy patient_activities_insert_owner_or_secretary on public.patient_activities
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  );

-- Founder decision (2026-07-28, live end-to-end test): beauty_specialist can
-- now record treatment payments too, same as owner/secretary. Payment
-- *corrections* (refund/adjustment entries) stay owner/secretary-only —
-- not part of this decision, a separate, more sensitive operation.

alter policy treatment_payments_insert_owner_or_secretary on public.treatment_payments
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  );

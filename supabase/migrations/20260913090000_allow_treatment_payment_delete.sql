-- Sprint 32 — hard delete of a single payment ledger row, owner/secretary only.
--
-- Founder decision 2026-09-13: the "Bu Ay Toplam Ciro" drill-down needs to
-- remove a mistakenly-entered payment outright, not only reverse it via a
-- refund/adjustment entry. This deliberately relaxes the original append-only
-- ledger design (see 20260724090000_create_treatment_module.sql, which granted
-- only SELECT + INSERT and documented "no UPDATE/DELETE policy at all"). The
-- founder was shown the audit-trail tradeoff and chose hard delete over
-- soft delete; there is intentionally no deleted_at / recovery path here.
--
-- Applies to the whole shared treatment_payments table, so it covers both
-- legacy series-attached and new plan-attached rows. Role set mirrors the
-- payment correction gate (owner/secretary), NOT the wider insert gate that
-- also allows beauty_specialist.

grant delete on public.treatment_payments to authenticated;

create policy treatment_payments_delete_owner_or_secretary on public.treatment_payments
  for delete
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  );

comment on table public.treatment_payments is
  'Payment ledger. INSERT: owner/secretary/beauty_specialist. Corrections are '
  'appended as refund/adjustment rows (never an UPDATE). DELETE: owner/secretary '
  '(Sprint 32) — removes a mistaken entry outright from the Dashboard revenue '
  'drill-down; hard delete, no recovery.';

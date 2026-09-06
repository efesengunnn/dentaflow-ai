-- Sprint 28: Treatment Plan redesign — first of 7 additive migrations that
-- introduce treatment_plans/treatment_plan_items/treatment_sessions
-- alongside (not replacing) treatment_series/treatments/treatment_payments.
-- See docs/DATABASE.md "Treatment Plan Module (Sprint 28)" for the full
-- design record and the reasoning behind every deviation from the legacy
-- Sprint 7 model.
--
-- treatment_sessions gets its own 3-value status enum (completed | corrected
-- | voided) rather than reusing treatment_lifecycle_status (active |
-- completed | cancelled | voided): a session row is only ever created at
-- the moment a visit is actually performed — appointments already own the
-- "scheduled but not yet happened" state — so the "active" value the legacy
-- treatments.status carries for that purpose has no meaning here.
-- treatment_plans/treatment_plan_items reuse treatment_lifecycle_status
-- directly instead (see the next two migrations).

create type public.treatment_session_status as enum (
  'completed',
  'corrected',
  'voided'
);

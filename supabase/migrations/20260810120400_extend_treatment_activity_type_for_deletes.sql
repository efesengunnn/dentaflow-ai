-- Sprint 28C.1: Flexible Delete & Audit — new audit events for the new
-- delete actions. No `payment_deleted` value: treatment_payments stays
-- append-only (founder decision, Sprint 28C.1) — a payment "delete" is
-- still recorded through the existing `void` ledger entry type, not a new
-- activity type. `appointment_deleted` already exists on the separate
-- appointment_activity_type enum (20260722130000).
alter type public.treatment_activity_type add value 'plan_deleted';
alter type public.treatment_activity_type add value 'plan_item_deleted';
alter type public.treatment_activity_type add value 'session_deleted';

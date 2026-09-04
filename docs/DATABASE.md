# Database — DentaFlow AI

Data model and multi-tenancy strategy. The baseline schema
(`supabase/migrations/20260904000000_baseline_schema.sql`) implements: `clinics`,
`staff_members`, `staff_permissions`, `audit_logs`, `leads`, `lead_activities`, `patients`,
`patient_activities`, `appointments`, `appointment_activities` — carried over from ClinicFlow
AI's architecture, reconciled into one file (see that migration's own header comment for
provenance). RLS strategy: `current_clinic_id()` / `current_staff_role()` /
`current_staff_has_permission()` SECURITY DEFINER helpers, default-deny, every policy scoped to
`clinic_id = current_clinic_id()`.

Not yet written: the dental treatment/procedure schema (tooth charting, procedures, treatment
plans) — this is the next real schema decision and should get its own design pass here before
any migration is written for it.

# Database — DentaFlow AI

Data model and multi-tenancy strategy. The baseline schema
(`supabase/migrations/20260904000000_baseline_schema.sql`) implements: `clinics`,
`staff_members`, `staff_permissions`, `audit_logs`, `leads`, `lead_activities`, `patients`,
`patient_activities`, `appointments`, `appointment_activities` — carried over from ClinicFlow
AI's architecture, reconciled into one file (see that migration's own header comment for
provenance). RLS strategy: `current_clinic_id()` / `current_staff_role()` /
`current_staff_has_permission()` SECURITY DEFINER helpers, default-deny, every policy scoped to
`clinic_id = current_clinic_id()`.

## Dental Treatment Module (v1)

`supabase/migrations/20260905000000_create_dental_treatment_module.sql` adds the dental-specific
domain. Scope (founder decision, 2026-09-05): permanent dentition only (32 teeth, FDI notation
11-18/21-28/31-38/41-48), no orthodontics, no SGK/insurance — private-pay only.

- **`tooth_conditions`** — the *current* state of one tooth. Sparse: a row exists only for a
  non-healthy tooth (`unique(patient_id, tooth_number)`); a missing row means healthy. Kept in
  sync by a trigger, never written directly by the application for a completed treatment.
- **`tooth_treatments`** — the actual clinical/billing log, one row per procedure planned or
  performed on one tooth (`muayene`/`dolgu`/`kanal_tedavisi`/`cekim`/`kaplama`/`implant`/`kopru`/
  `dis_tasi_temizligi`/`beyazlatma`/`diger`), with its own `planlandi`/`tamamlandi`/`iptal`
  status and soft-delete (same `deleted_at`/`deleted_by`/`delete_reason` convention as
  `appointments`). `appointment_id` is an optional FK — not every appointment produces a tooth
  treatment.
- **`sync_tooth_condition_from_treatment()`** (AFTER INSERT/UPDATE trigger) — when a treatment
  is marked `tamamlandi`, upserts the matching `tooth_conditions` row (e.g. `dolgu` →
  `dolgulu`, `cekim` → `eksik`). This is the single place tooth state changes; the application
  never writes `tooth_conditions` for a completed-here treatment, only for a baseline/
  pre-existing condition marked directly (see `setToothCondition` in `lib/teeth/actions.ts`).
- **`treatment_catalog`** — one clinic-wide price list (owner-managed), no per-staff pricing.
- **`patient_payments`** — private-pay collection log. "Kalan Bakiye" is always derived (sum of
  completed `tooth_treatments.price` minus sum of `patient_payments.amount`), never stored.

RLS: `tooth_conditions`/`tooth_treatments` writes restricted to `owner`/`doctor` (the roles that
actually perform treatments); `patient_payments` writes to `owner`/`secretary` (front-desk);
`treatment_catalog` writes to `owner` only. All four follow the same
`clinic_id = current_clinic_id()` select-scoping as every other table.

Not yet written: orthodontics (long-running, recurring-adjustment treatment plans) and SGK/
insurance billing — both explicitly deferred past v1, revisit as their own schema decisions.

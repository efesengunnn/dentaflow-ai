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

## Tooth-based treatment completion (2026-10-14)

`supabase/migrations/20261014090000_track_treatment_completion_per_tooth.sql`. Session-based
progress ("2 / 3 Seans") on treatment plan items is replaced by per-tooth completion.

- **`treatment_sessions.tooth_numbers smallint[]`** — which of the item's FDI teeth a completion
  covered. `null` = legacy session-based completion (no tooth info), `'{}'` = completion of an
  item with no charted teeth, otherwise exactly those teeth. Same FDI validity check as
  `treatment_plan_items.tooth_numbers`. Each "Tamamlandı" click inserts one session row (who =
  the item's hekim, when = today in Istanbul); "Geri al" voids that row (`status = 'voided'`).
- **`sync_treatment_plan_item_status(item_id)`** — an item is `completed` when every charted
  tooth is covered by a live (`completed`, not deleted) completion, or — no teeth charted — when
  any tooth-based completion exists. Legacy rule kept: completed once `null`-teeth sessions
  reach `session_count`. Toggles only `active` ↔ `completed`; `cancelled`/`voided` untouched.
- **`sync_treatment_plan_status(plan_id)`** — a plan is `completed` when no live item is still
  `active` and at least one is `completed`.
- Triggers: `treatment_sessions_sync_item_status` (after insert / update of `status`,
  `deleted_at`, `tooth_numbers`) and `treatment_plan_items_sync_statuses` (after update of
  `tooth_numbers`, `session_count`, `status`, `deleted_at`). Both are SECURITY DEFINER because a
  secretary may complete/undo a treatment (session INSERT/UPDATE) but RLS does not let them
  update items or plans; they run inside the user's own statement so the audit trigger still
  sees `auth.uid()`.
- Backfill: active legacy items whose completed sessions already reached `session_count` were
  flipped to `completed` (and their plans, where every item was done). Prices and payments are
  untouched.

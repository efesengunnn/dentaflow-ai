import type { Database } from "@/lib/supabase/database.types"

export type TreatmentLifecycleStatus = Database["public"]["Enums"]["treatment_lifecycle_status"]
export type TreatmentSessionStatus = Database["public"]["Enums"]["treatment_session_status"]
export type TreatmentPaymentEntryType = Database["public"]["Enums"]["treatment_payment_entry_type"]
export type TreatmentPaymentMethod = Database["public"]["Enums"]["treatment_payment_method"]
export type TreatmentActivityType = Database["public"]["Enums"]["treatment_activity_type"]

/** Same enum/labels as legacy `treatment_series.status` — reused independently here (not imported from `lib/treatments/constants`) so this module stays self-contained ahead of the legacy module's eventual retirement. */
export const TREATMENT_PLAN_STATUS_LABELS: Record<TreatmentLifecycleStatus, string> = {
  active: "Aktif",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  voided: "Geçersiz Kılındı",
}

export const TREATMENT_PLAN_STATUS_BADGE_VARIANT: Record<
  TreatmentLifecycleStatus,
  "secondary" | "default" | "warning" | "success" | "destructive"
> = {
  active: "secondary",
  completed: "success",
  cancelled: "warning",
  voided: "destructive",
}

/** `voided` is excluded — it never represents a real event. */
export const TREATMENT_PLAN_STATUS_OPTIONS: { value: TreatmentLifecycleStatus; label: string }[] = (
  ["active", "completed", "cancelled"] as const
).map((value) => ({ value, label: TREATMENT_PLAN_STATUS_LABELS[value] }))

/** `treatment_sessions.status` — a session only ever exists once performed, so there is no "Planlandı" value here (unlike the legacy per-session label override on `treatment_lifecycle_status`). See docs/DATABASE.md#treatment-sessions. */
export const TREATMENT_SESSION_STATUS_LABELS: Record<TreatmentSessionStatus, string> = {
  completed: "Tamamlandı",
  corrected: "Düzeltildi",
  voided: "Geçersiz Kılındı",
}

export const TREATMENT_SESSION_STATUS_BADGE_VARIANT: Record<
  TreatmentSessionStatus,
  "secondary" | "default" | "warning" | "success" | "destructive"
> = {
  completed: "success",
  corrected: "warning",
  voided: "destructive",
}

export const TREATMENT_PAYMENT_METHOD_LABELS: Record<TreatmentPaymentMethod, string> = {
  cash: "Nakit",
  credit_card: "Kredi Kartı",
  bank_transfer: "Havale/EFT/IBAN",
  other: "Diğer",
}

export const TREATMENT_PAYMENT_METHOD_OPTIONS: { value: TreatmentPaymentMethod; label: string }[] = (
  Object.keys(TREATMENT_PAYMENT_METHOD_LABELS) as TreatmentPaymentMethod[]
).map((value) => ({ value, label: TREATMENT_PAYMENT_METHOD_LABELS[value] }))

export const TREATMENT_PAYMENT_ENTRY_TYPE_LABELS: Record<TreatmentPaymentEntryType, string> = {
  payment: "Ödeme",
  refund: "İade",
  adjustment: "Düzeltme",
  void: "Geçersiz Kılma",
}

/** Same "correction is always a new row referencing the original, never a free-form type picker" rule as the legacy payment ledger. */
export const TREATMENT_PAYMENT_ENTRY_TYPE_OPTIONS: {
  value: TreatmentPaymentEntryType
  label: string
}[] = (["refund", "adjustment"] as const).map((value) => ({
  value,
  label: TREATMENT_PAYMENT_ENTRY_TYPE_LABELS[value],
}))

export const TREATMENT_ACTIVITY_LABELS: Record<TreatmentActivityType, string> = {
  series_created: "Plan oluşturuldu",
  series_updated: "Plan bilgileri güncellendi",
  treatment_created: "Seans kaydı oluşturuldu",
  treatment_updated: "Seans kaydı güncellendi",
  status_changed: "Durum değiştirildi",
  payment_recorded: "Ödeme kaydedildi",
  note_added: "Not eklendi",
  treatment_deleted: "Seans kaydı silindi",
  plan_deleted: "Plan silindi",
  plan_item_deleted: "Tedavi kalemi silindi",
  session_deleted: "Seans kaydı silindi",
}

/** A front-desk (`secretary`) correction/void on a `treatment_sessions` row is only allowed within this many hours of the row's `created_at` — anchored on submission time, not the clinical `performed_at` date, so a back-dated entry doesn't get a confusing already-expired window. Mirrors the RLS policy in `20260810090300_create_treatment_sessions.sql`. */
export const SESSION_CORRECTION_WINDOW_HOURS = 24

/**
 * Follow-up detection matches free-text `treatment_plan_items.treatment_name`
 * by keyword — same rule set as the legacy `lib/ai/constants.ts`
 * `FOLLOW_UP_RULES`, duplicated here (not imported) so this module stays
 * independently usable ahead of Sprint 28's later AI-layer cutover (see
 * `docs/CHANGELOG.md`). `intervalDays` is the fallback when a session has no
 * doctor-entered `treatment_sessions.control_date`.
 */
export const FOLLOW_UP_RULES = [
  { key: "botoks", label: "Botoks", keywords: ["botoks", "botox"], intervalDays: 150 },
  { key: "prp", label: "PRP", keywords: ["prp"], intervalDays: 30 },
  { key: "mezoterapi", label: "Mezoterapi", keywords: ["mezoterapi", "mesoterapi"], intervalDays: 30 },
] as const

export type FollowUpRuleKey = (typeof FOLLOW_UP_RULES)[number]["key"]

/** "30+ gündür gelmeyen aktif hastalar" — days since a patient's last completed session, across any plan. */
export const INACTIVE_PATIENT_THRESHOLD_DAYS = 30

/** "Planı 1 seans kalanlar" — an active plan item with exactly this many sessions left. */
export const PLAN_ENDING_SESSIONS_REMAINING = 1

/**
 * Session count/date fields default a new one-off treatment plan to
 * "1 item, 1 session" — there is no separate form/mode for a single
 * session vs. a multi-session plan, per founder decision (Sprint 28): both
 * go through the same Tedavi Planı wizard.
 */
export const STANDALONE_TREATMENT_SESSION_COUNT = 1

export const PATIENT_TREATMENT_PLAN_LIMIT = 10

import type { Database } from "@/lib/supabase/database.types"

export type TreatmentLifecycleStatus = Database["public"]["Enums"]["treatment_lifecycle_status"]
export type TreatmentPaymentEntryType = Database["public"]["Enums"]["treatment_payment_entry_type"]
export type TreatmentPaymentMethod = Database["public"]["Enums"]["treatment_payment_method"]
export type TreatmentActivityType = Database["public"]["Enums"]["treatment_activity_type"]

export const TREATMENT_STATUS_LABELS: Record<TreatmentLifecycleStatus, string> = {
  active: "Aktif",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  voided: "Geçersiz Kılındı",
}

export const TREATMENT_STATUS_BADGE_VARIANT: Record<
  TreatmentLifecycleStatus,
  "secondary" | "default" | "warning" | "success" | "destructive"
> = {
  active: "secondary",
  completed: "success",
  cancelled: "warning",
  voided: "destructive",
}

/** `voided` is excluded — it never represents a real event, see docs/DATABASE.md. */
export const TREATMENT_STATUS_OPTIONS: { value: TreatmentLifecycleStatus; label: string }[] = (
  ["active", "completed", "cancelled"] as const
).map((value) => ({ value, label: TREATMENT_STATUS_LABELS[value] }))

/**
 * Sprint 12 — same `treatment_lifecycle_status` enum, a different label at
 * the individual session/one-off-treatment level than at the package level.
 * "Aktif" is exactly right for a *series* ("bu paket hâlâ devam ediyor"),
 * but reads as vague/technical for one *session* — "Planlandı" (scheduled,
 * not yet done) is what a clinic staff member actually means there. No
 * database value changes; this is purely which label the same `active`
 * value renders as, in the `StandaloneTreatmentForm`/`SessionForm` "Durum"
 * pickers only — `TreatmentStatusBadge` (series-level) keeps
 * `TREATMENT_STATUS_LABELS` unchanged.
 */
export const TREATMENT_SESSION_STATUS_LABELS: Record<TreatmentLifecycleStatus, string> = {
  ...TREATMENT_STATUS_LABELS,
  active: "Planlandı",
}

export const TREATMENT_SESSION_STATUS_OPTIONS: { value: TreatmentLifecycleStatus; label: string }[] = (
  ["active", "completed", "cancelled"] as const
).map((value) => ({ value, label: TREATMENT_SESSION_STATUS_LABELS[value] }))

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

/**
 * `payment` is the only entry type the primary "Ödeme Ekle" form exposes —
 * refund/adjustment/void are separate, rarer actions (see
 * lib/treatments/actions.ts) that always reference the payment they correct
 * via `related_payment_id`, not a free-form type picker on the same form.
 */
export const TREATMENT_PAYMENT_ENTRY_TYPE_OPTIONS: {
  value: TreatmentPaymentEntryType
  label: string
}[] = (["refund", "adjustment"] as const).map((value) => ({
  value,
  label: TREATMENT_PAYMENT_ENTRY_TYPE_LABELS[value],
}))

export const TREATMENT_ACTIVITY_LABELS: Record<TreatmentActivityType, string> = {
  series_created: "Paket oluşturuldu",
  series_updated: "Paket bilgileri güncellendi",
  treatment_created: "Tedavi kaydı oluşturuldu",
  treatment_updated: "Tedavi kaydı güncellendi",
  status_changed: "Durum değiştirildi",
  payment_recorded: "Ödeme kaydedildi",
  note_added: "Not eklendi",
  treatment_deleted: "Tedavi kaydı silindi",
  // Sprint 28C.1: these three only ever get written against
  // treatment_plans/treatment_plan_items/treatment_sessions rows (the new
  // schema) — never against this legacy module's own tables — but the
  // shared `treatment_activity_type` DB enum still requires this map to be
  // exhaustive.
  plan_deleted: "Plan silindi",
  plan_item_deleted: "Tedavi kalemi silindi",
  session_deleted: "Seans kaydı silindi",
}

/**
 * Session count/date fields default a new one-off treatment to "session 1 of
 * 1" — the series is invisible, but these are the values it's created with.
 * See docs/DATABASE.md "every treatment always belongs to a series".
 */
export const STANDALONE_TREATMENT_TOTAL_SESSIONS = 1

export const PATIENT_TREATMENT_SERIES_LIMIT = 10

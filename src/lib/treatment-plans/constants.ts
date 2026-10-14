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

export const PATIENT_TREATMENT_PLAN_LIMIT = 10

/**
 * Tooth-based progress (founder decision 2026-10-14), replacing the session
 * counter on the patient card and appointment detail: an item is in progress,
 * partly done (several charted teeth, only some completed) or done. `done`
 * always follows `status`, which the database keeps in sync — see
 * `20261014090000_track_treatment_completion_per_tooth.sql`.
 */
export type TreatmentProgress = "pending" | "partial" | "done"

export const TREATMENT_PROGRESS_LABELS: Record<TreatmentProgress, string> = {
  pending: "Devam Ediyor",
  partial: "Kısmen Tamamlandı",
  done: "Tamamlandı",
}

export const TREATMENT_PROGRESS_BADGE_VARIANT: Record<TreatmentProgress, "warning" | "info" | "success"> = {
  pending: "warning",
  partial: "info",
  done: "success",
}

/** Teeth of an item covered by a live tooth-based completion; every tooth once the item is `completed` (legacy session-based items carry no tooth info). */
export function collectCompletedTeeth(
  status: TreatmentLifecycleStatus,
  toothNumbers: readonly number[],
  completions: readonly { toothNumbers: readonly number[] }[],
): number[] {
  if (status === "completed") return [...toothNumbers]
  const done = new Set(completions.flatMap((completion) => completion.toothNumbers))
  return toothNumbers.filter((tooth) => done.has(tooth))
}

export function deriveItemProgress(item: {
  status: TreatmentLifecycleStatus
  toothNumbers: readonly number[]
  completedToothNumbers: readonly number[]
}): TreatmentProgress {
  if (item.status === "completed") return "done"
  return item.toothNumbers.length > 1 && item.completedToothNumbers.length > 0 ? "partial" : "pending"
}

export function derivePlanProgress(plan: {
  status: TreatmentLifecycleStatus
  items: readonly { status: TreatmentLifecycleStatus; toothNumbers: readonly number[]; completedToothNumbers: readonly number[] }[]
}): TreatmentProgress {
  if (plan.status === "completed") return "done"
  return plan.items.some((item) => deriveItemProgress(item) !== "pending") ? "partial" : "pending"
}

/**
 * An item's line total: the unit price applies per charted tooth (3 teeth of
 * Dolgu = 3× the Dolgu price). No teeth charted = whole-mouth/one-off, priced
 * once. Session count never multiplies it (founder decision 2026-09-13).
 * Shared by the wizard's live totals and the server actions so the preview
 * and the stored `total_price` can never disagree.
 */
export function computeItemTotalPrice(
  unitPrice: number | null | undefined,
  toothNumbers: readonly number[] | null | undefined,
): number | null {
  if (unitPrice === null || unitPrice === undefined) return null
  return unitPrice * Math.max(1, toothNumbers?.length ?? 0)
}

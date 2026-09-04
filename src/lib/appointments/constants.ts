import type { Database } from "@/lib/supabase/database.types"

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"]
export type AppointmentActivityType = Database["public"]["Enums"]["appointment_activity_type"]

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  no_show: "Gelmedi",
}

/**
 * Sprint 20 — `cancelled` moved from `destructive` to `warning`: a cancelled
 * appointment is a normal, everyday scheduling outcome, not a destructive
 * event, and keeping `destructive`/red reserved for genuinely critical
 * states (form errors, permanent-delete confirmations) is the whole point
 * of the color-usage discipline in `docs/DESIGN_SYSTEM.md`.
 */
export const APPOINTMENT_STATUS_BADGE_VARIANT: Record<
  AppointmentStatus,
  "secondary" | "default" | "warning" | "success" | "destructive"
> = {
  scheduled: "secondary",
  confirmed: "default",
  completed: "success",
  cancelled: "warning",
  no_show: "warning",
}

export const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = (
  Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]
).map((value) => ({ value, label: APPOINTMENT_STATUS_LABELS[value] }))

export const APPOINTMENT_ACTIVITY_LABELS: Record<AppointmentActivityType, string> = {
  appointment_created: "Randevu oluşturuldu",
  appointment_updated: "Randevu bilgileri güncellendi",
  status_changed: "Durum değiştirildi",
  note_added: "Not eklendi",
  appointment_deleted: "Randevu silindi",
}

/** Clinic operating hours used to generate `TimeSelect`'s slot list (15-minute increments). */
export const APPOINTMENT_HOURS_START = 8
export const APPOINTMENT_HOURS_END = 20

export const APPOINTMENTS_PAGE_SIZE = 20

/**
 * Reverse label -> enum-value lookup, case/whitespace-insensitive — same
 * pattern as `parseLeadStatusLabel`/`parseLeadSourceLabel`, used by Excel
 * import so a secretary can type the Turkish label shown on screen.
 */
function buildReverseLookup<T extends string>(labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>()
  for (const [value, label] of Object.entries(labels) as [T, string][]) {
    map.set(label.trim().toLocaleLowerCase("tr"), value)
  }
  return map
}

const APPOINTMENT_STATUS_BY_LABEL = buildReverseLookup(APPOINTMENT_STATUS_LABELS)

export function parseAppointmentStatusLabel(label: string): AppointmentStatus | undefined {
  return APPOINTMENT_STATUS_BY_LABEL.get(label.trim().toLocaleLowerCase("tr"))
}

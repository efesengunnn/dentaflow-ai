import type { Database } from "@/lib/supabase/database.types"

export type PatientActivityType = Database["public"]["Enums"]["patient_activity_type"]

export const PATIENT_ACTIVITY_LABELS: Record<PatientActivityType, string> = {
  patient_created: "Kayıt oluşturuldu",
  patient_updated: "Bilgiler güncellendi",
  note_added: "Not eklendi",
  patient_deleted: "Kayıt silindi",
}

/**
 * "Hasta Tipi" filter — patients have no status pipeline (unlike leads), so
 * this isn't a status filter; it's a real, existing data distinction
 * (whether `lead_id` is set) rather than a speculative field invented for
 * the sake of matching Leads' filter row. See docs/CHANGELOG.md's Sprint 4
 * reconciliation note.
 */
export const PATIENT_ORIGIN_OPTIONS = [
  { value: "converted", label: "Potansiyel Müşteriden Dönüştürüldü" },
  { value: "direct", label: "Doğrudan Kayıt" },
] as const

export type PatientOrigin = (typeof PATIENT_ORIGIN_OPTIONS)[number]["value"]

export const PATIENTS_PAGE_SIZE = 20

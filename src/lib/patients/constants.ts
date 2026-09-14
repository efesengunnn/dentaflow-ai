import type { Database } from "@/lib/supabase/database.types"

export type PatientActivityType = Database["public"]["Enums"]["patient_activity_type"]

export const PATIENT_ACTIVITY_LABELS: Record<PatientActivityType, string> = {
  patient_created: "Kayıt oluşturuldu",
  patient_updated: "Bilgiler güncellendi",
  note_added: "Not eklendi",
  patient_deleted: "Kayıt silindi",
}

export const PATIENTS_PAGE_SIZE = 20

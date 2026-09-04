import type { ToothConditionStatus, ToothTreatmentStatus, ToothTreatmentType } from "@/lib/teeth/constants"
import { createClient } from "@/lib/supabase/server"

export type ToothConditionRow = {
  toothNumber: number
  status: ToothConditionStatus
  note: string | null
  updatedAt: string
}

/** Keyed by tooth number for O(1) lookup while rendering the 32-tooth chart. */
export async function getToothConditionsForPatient(
  patientId: string,
): Promise<Map<number, ToothConditionRow>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tooth_conditions")
    .select("tooth_number, status, note, updated_at")
    .eq("patient_id", patientId)

  if (error) throw error

  return new Map(
    (data ?? []).map((row) => [
      row.tooth_number,
      { toothNumber: row.tooth_number, status: row.status, note: row.note, updatedAt: row.updated_at },
    ]),
  )
}

export type ToothTreatmentRow = {
  id: string
  toothNumber: number
  treatmentType: ToothTreatmentType
  customTreatmentName: string | null
  status: ToothTreatmentStatus
  price: number | null
  performedByName: string | null
  appointmentId: string | null
  performedAt: string
  note: string | null
  createdAt: string
}

const TOOTH_TREATMENT_SELECT =
  "id, tooth_number, treatment_type, custom_treatment_name, status, price, appointment_id, performed_at, note, created_at, provider:staff_members!tooth_treatments_performed_by_fkey(full_name)"

type RawToothTreatmentRow = {
  id: string
  tooth_number: number
  treatment_type: ToothTreatmentType
  custom_treatment_name: string | null
  status: ToothTreatmentStatus
  price: number | null
  appointment_id: string | null
  performed_at: string
  note: string | null
  created_at: string
  provider: { full_name: string } | null
}

function mapToothTreatmentRow(row: RawToothTreatmentRow): ToothTreatmentRow {
  return {
    id: row.id,
    toothNumber: row.tooth_number,
    treatmentType: row.treatment_type,
    customTreatmentName: row.custom_treatment_name,
    status: row.status,
    price: row.price,
    performedByName: row.provider?.full_name ?? null,
    appointmentId: row.appointment_id,
    performedAt: row.performed_at,
    note: row.note,
    createdAt: row.created_at,
  }
}

/** Full treatment history for a patient, most recent first — feeds both the chart's per-tooth history and a patient-wide timeline. */
export async function getToothTreatmentsForPatient(patientId: string): Promise<ToothTreatmentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tooth_treatments")
    .select(TOOTH_TREATMENT_SELECT)
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("performed_at", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapToothTreatmentRow)
}

"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import type { ToothConditionStatus } from "@/lib/teeth/constants"
import { getUnlinkedPlannedTreatmentsForPatient, type ToothTreatmentRow } from "@/lib/teeth/queries"
import { toothTreatmentFormSchema, type ToothTreatmentFormValues } from "@/lib/teeth/schema"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

export type ToothActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

export async function createToothTreatment(
  patientId: string,
  values: ToothTreatmentFormValues,
): Promise<ToothActionState> {
  const parsed = toothTreatmentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("tooth_treatments").insert({
    clinic_id: staffMember.clinicId,
    patient_id: patientId,
    tooth_number: parsed.data.toothNumber,
    treatment_type: parsed.data.treatmentType,
    custom_treatment_name:
      parsed.data.treatmentType === "diger" ? parsed.data.customTreatmentName?.trim() || null : null,
    status: parsed.data.status,
    price: parsed.data.price ?? null,
    performed_by: parsed.data.performedBy,
    appointment_id: parsed.data.appointmentId || null,
    performed_at: parsed.data.performedAt,
    note: parsed.data.note?.trim() || null,
    created_by: staffMember.userId,
    updated_by: staffMember.userId,
  })

  if (error) return { error: "Tedavi kaydedilemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

export async function updateToothTreatmentStatus(
  patientId: string,
  treatmentId: string,
  status: "planlandi" | "tamamlandi" | "iptal",
): Promise<ToothActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("tooth_treatments")
    .update({ status, updated_by: staffMember.userId })
    .eq("id", treatmentId)

  if (error) return { error: "Tedavi güncellenemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

const DEFAULT_DELETE_REASON = "Diş tedavisi ekranından silindi."

export async function removeToothTreatment(
  patientId: string,
  treatmentId: string,
  reason?: string,
): Promise<ToothActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("tooth_treatments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: staffMember.userId,
      delete_reason: reason?.trim() || DEFAULT_DELETE_REASON,
      updated_by: staffMember.userId,
    })
    .eq("id", treatmentId)

  if (error) return { error: "Tedavi silinemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

/**
 * Directly sets a tooth's current condition without a billable treatment
 * row — for a new patient's baseline exam, marking a pre-existing condition
 * (a filling done at another clinic, a missing tooth from before) that was
 * never actually performed here. `note` is `null` clears any existing
 * override note.
 */
export async function setToothCondition(
  patientId: string,
  toothNumber: number,
  status: ToothConditionStatus,
  note?: string,
): Promise<ToothActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("tooth_conditions").upsert(
    {
      clinic_id: staffMember.clinicId,
      patient_id: patientId,
      tooth_number: toothNumber,
      status,
      note: note?.trim() || null,
      updated_by: staffMember.userId,
    },
    { onConflict: "patient_id,tooth_number" },
  )

  if (error) return { error: "Diş durumu güncellenemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

/** Client-callable wrapper — feeds the appointment form's "Bağlı Tedaviler" picker when the selected patient changes. */
export async function fetchUnlinkedTreatmentsForPatient(patientId: string): Promise<ToothTreatmentRow[]> {
  if (!patientId) return []
  return getUnlinkedPlannedTreatmentsForPatient(patientId)
}

/**
 * Bulk-attaches already-defined, unlinked planned treatments to an
 * appointment at creation time — the "Bağlı Tedaviler" picker on the
 * appointment form. Silently no-ops on an empty list (most appointments
 * have none).
 */
export async function linkTreatmentsToAppointment(
  appointmentId: string,
  treatmentIds: string[],
): Promise<ToothActionState> {
  if (treatmentIds.length === 0) return { success: true }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("tooth_treatments")
    .update({ appointment_id: appointmentId, updated_by: staffMember.userId })
    .in("id", treatmentIds)

  if (error) return { error: "Tedaviler randevuya bağlanamadı." }

  return { success: true }
}

/**
 * One shared treatment (same type/status/price/provider/date/note) applied
 * to several teeth in one go — the tooth chart's multi-select "Tedavi Ekle"
 * action, for the common case of doing the same procedure on more than one
 * tooth in a single visit (e.g. two fillings the same day).
 */
export async function createToothTreatmentsForTeeth(
  patientId: string,
  toothNumbers: number[],
  values: ToothTreatmentFormValues,
): Promise<ToothActionState> {
  if (toothNumbers.length === 0) return { error: "En az bir diş seçin." }

  const parsed = toothTreatmentFormSchema.safeParse({ ...values, toothNumber: toothNumbers[0] })
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("tooth_treatments").insert(
    toothNumbers.map((toothNumber) => ({
      clinic_id: staffMember.clinicId,
      patient_id: patientId,
      tooth_number: toothNumber,
      treatment_type: parsed.data.treatmentType,
      custom_treatment_name:
        parsed.data.treatmentType === "diger" ? parsed.data.customTreatmentName?.trim() || null : null,
      status: parsed.data.status,
      price: parsed.data.price ?? null,
      performed_by: parsed.data.performedBy,
      appointment_id: parsed.data.appointmentId || null,
      performed_at: parsed.data.performedAt,
      note: parsed.data.note?.trim() || null,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })),
  )

  if (error) return { error: "Tedaviler kaydedilemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

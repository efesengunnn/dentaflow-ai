"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { appointmentFormDefaults } from "@/lib/appointments/schema"
import { insertAppointment, type CreateAppointmentResult } from "@/lib/appointments/actions"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { PATIENT_ACTIVITY_LABELS } from "@/lib/patients/constants"
import {
  parsePatientsWorkbook,
  type PatientImportRow,
  type PatientImportRowError,
} from "@/lib/patients/import"
import { findPatientByPhone, type PatientOption } from "@/lib/patients/queries"
import { patientFormSchema, type PatientFormValues } from "@/lib/patients/schema"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { createTreatmentPlan } from "@/lib/treatment-plans/actions"
import { flattenZodError } from "@/lib/validation/zod"

type PatientActivityInsert = Database["public"]["Tables"]["patient_activities"]["Insert"]

export type PatientActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; patient?: PatientOption; error?: undefined }
  | undefined

type InsertPatientResult =
  | { error: string; fieldErrors?: Record<string, string> }
  | { patient: PatientOption; values: PatientFormValues }

/**
 * The actual insert + activity-log logic, without the redirect — extracted
 * so `createPatient` (full-page create, redirects on success) and
 * `createPatientQuick` (Sprint 14 — inline "+ Yeni Hasta" from the
 * appointment form's patient Combobox, needs the created patient's id back,
 * not a redirect) share one write path. Same "insertX / createX" split
 * already used for appointments (`lib/appointments/actions.ts`).
 */
async function insertPatient(values: PatientFormValues): Promise<InsertPatientResult> {
  const parsed = patientFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: staffMember.clinicId,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      tc_kimlik_no: parsed.data.tcKimlikNo || null,
      date_of_birth: parsed.data.dateOfBirth || null,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (error || !patient) {
    return {
      error:
        "Hasta oluşturulamadı. Bu telefon numarasıyla zaten bir kayıt olabilir — bilgileri kontrol edip tekrar deneyin.",
    }
  }

  const activities: PatientActivityInsert[] = [
    {
      clinic_id: staffMember.clinicId,
      patient_id: patient.id,
      activity_type: "patient_created",
      description: PATIENT_ACTIVITY_LABELS.patient_created,
      created_by: staffMember.userId,
    },
  ]
  if (parsed.data.note?.trim()) {
    activities.push({
      clinic_id: staffMember.clinicId,
      patient_id: patient.id,
      activity_type: "note_added",
      description: parsed.data.note.trim(),
      created_by: staffMember.userId,
    })
  }
  await supabase.from("patient_activities").insert(activities)

  revalidatePath("/patients")

  return {
    patient: { id: patient.id, fullName: parsed.data.fullName, phone: parsed.data.phone },
    values: parsed.data,
  }
}

export async function createPatient(values: PatientFormValues): Promise<PatientActionState> {
  const result = await insertPatient(values)
  if ("error" in result) return result

  // "Aynı anda randevu oluştur" — reuses appointments/actions.ts' insert
  // logic exactly (overlap check included), not a duplicate write path. A
  // conflict at this exact moment is rare but real (Sprint 8 review); the
  // patient record is already safely created either way, so a failure here
  // surfaces as a query-param flash on the patient page rather than losing
  // the whole submission.
  //
  // Always lands on the patient's own card (not the appointment's), with or
  // without a simultaneous appointment — the founder's explicit requirement
  // that patient creation always opens the same screen Hastalar itself
  // links to. The new appointment is already visible there, in Randevular,
  // the moment the page loads, so nothing about it is hidden by not
  // redirecting to `/appointments/[id]` instead.
  if (result.values.createAppointment) {
    // Founder decision 2026-07-28 — a treatment picked here is always a
    // single, standalone booking (not a multi-session package; that still
    // needs the full treatment-plan builder), same as filling only
    // İşlem/Ücret used to do in the old standalone appointment mode.
    // Sprint 30: that mode was removed from the appointment form itself, so
    // this quick-create path now creates its own 1-item plan the same way
    // the appointment Sheet's inline builder does, then links it — one
    // unified "an appointment only ever links to an already-resolved plan
    // item" rule, no separate scalar-field code path left anywhere.
    const treatmentType = result.values.treatmentType?.trim()
    const appointmentStaffId = result.values.appointmentStaffId ?? ""

    // Unlike the standalone appointment flow, the patient is already
    // committed by this point — a *thrown* error here (network blip, an
    // unexpected Supabase error) must never be allowed to propagate
    // uncaught, or the founder is left with a silently-created patient and
    // no appointment and no explanation. `redirect()` itself throws
    // (Next.js's control-flow mechanism), so every `redirect()` call below
    // is deliberately outside this try block, never inside it — the block
    // only ever returns a plain value or a caught plain error, both handled
    // by the redirects that follow it.
    let appointmentResult: CreateAppointmentResult | undefined
    try {
      let treatmentPlanId: string | undefined
      let treatmentPlanItemId: string | undefined
      let planError: string | undefined
      if (treatmentType) {
        const planResult = await createTreatmentPlan({
          patientId: result.patient.id,
          planName: treatmentType,
          items: [{ providerId: appointmentStaffId, treatmentName: treatmentType, sessionCount: 1, unitPrice: result.values.totalFee, currency: result.values.treatmentCurrency ?? "TRY" }],
        })
        if (planResult && "error" in planResult) {
          planError = planResult.error
        } else if (planResult) {
          treatmentPlanId = planResult.planId
          treatmentPlanItemId = planResult.itemIds[0]
        }
      }

      appointmentResult = planError
        ? { error: planError }
        : await insertAppointment({
            ...appointmentFormDefaults,
            patientId: result.patient.id,
            staffId: appointmentStaffId,
            date: result.values.appointmentDate ?? "",
            time: result.values.appointmentTime ?? "",
            treatmentPlanId,
            treatmentPlanItemId,
          })
    } catch {
      appointmentResult = undefined
    }

    if (!appointmentResult) {
      redirect(
        `/patients/${result.patient.id}?randevuHata=${encodeURIComponent(
          "Randevu oluşturulamadı, beklenmeyen bir hata oluştu. Lütfen randevuyu elle ekleyin.",
        )}`,
      )
    }
    if ("error" in appointmentResult) {
      redirect(`/patients/${result.patient.id}?randevuHata=${encodeURIComponent(appointmentResult.error)}`)
    }
    if (appointmentResult.treatmentWarning) {
      redirect(`/patients/${result.patient.id}?randevuHata=${encodeURIComponent(appointmentResult.treatmentWarning)}`)
    }
  }

  redirect(`/patients/${result.patient.id}`)
}

/**
 * "+ Yeni Hasta" (Sprint 14) — triggered from inside the appointment form's
 * patient Combobox. No redirect (the user is mid-appointment, not
 * navigating away) and no "Aynı anda randevu oluştur" branch (redundant —
 * they're already creating an appointment, that's why this Sheet is open).
 * Returns the created patient's id/name/phone so the caller can select it
 * in place, matching `PatientOption`'s exact shape.
 */
export async function createPatientQuick(values: PatientFormValues): Promise<PatientActionState> {
  const result = await insertPatient(values)
  if ("error" in result) return result
  return { success: true, patient: result.patient }
}

/**
 * Non-blocking duplicate-patient check for the Yeni Hasta form — called on
 * phone-field blur. A match is a warning, never a hard stop (see
 * `findPatientByPhone`).
 */
export async function checkDuplicatePatientByPhone(phone: string) {
  return findPatientByPhone(phone)
}

export async function updatePatient(
  patientId: string,
  values: PatientFormValues,
): Promise<PatientActionState> {
  const parsed = patientFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("patients")
    .select("full_name, phone, email, tc_kimlik_no, date_of_birth")
    .eq("id", patientId)
    .single()

  if (!existing) return { error: "Hasta bulunamadı." }

  const { error } = await supabase
    .from("patients")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      tc_kimlik_no: parsed.data.tcKimlikNo || null,
      date_of_birth: parsed.data.dateOfBirth || null,
      updated_by: staffMember.userId,
    })
    .eq("id", patientId)

  if (error) return { error: "Hasta güncellenemedi." }

  const activities: PatientActivityInsert[] = []

  const fieldsChanged =
    existing.full_name !== parsed.data.fullName ||
    existing.phone !== parsed.data.phone ||
    (existing.email ?? "") !== (parsed.data.email ?? "") ||
    (existing.tc_kimlik_no ?? "") !== (parsed.data.tcKimlikNo ?? "") ||
    (existing.date_of_birth ?? "") !== (parsed.data.dateOfBirth ?? "")

  if (fieldsChanged) {
    activities.push({
      clinic_id: staffMember.clinicId,
      patient_id: patientId,
      activity_type: "patient_updated",
      description: PATIENT_ACTIVITY_LABELS.patient_updated,
      created_by: staffMember.userId,
    })
  }

  if (parsed.data.note?.trim()) {
    activities.push({
      clinic_id: staffMember.clinicId,
      patient_id: patientId,
      activity_type: "note_added",
      description: parsed.data.note.trim(),
      created_by: staffMember.userId,
    })
  }

  if (activities.length) {
    await supabase.from("patient_activities").insert(activities)
  }

  revalidatePath("/patients")
  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

export async function addPatientNote(patientId: string, note: string): Promise<PatientActionState> {
  const trimmed = note.trim()
  if (!trimmed) return { error: "Not boş olamaz." }
  if (trimmed.length > 2000) return { error: "Not 2000 karakteri geçemez." }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("patient_activities").insert({
    clinic_id: staffMember.clinicId,
    patient_id: patientId,
    activity_type: "note_added",
    description: trimmed,
    created_by: staffMember.userId,
  })

  if (error) return { error: "Not eklenemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

export async function softDeletePatient(patientId: string): Promise<PatientActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("patients")
    .update({ deleted_at: new Date().toISOString(), updated_by: staffMember.userId })
    .eq("id", patientId)

  if (error) return { error: "Hasta silinemedi." }

  // Founder decision 2026-07-28: a deleted patient's appointments go with
  // them — a schedule entry for a patient that no longer exists has no
  // reason to keep showing up in Randevular/Takvim. One bulk update (not a
  // per-row loop), no per-appointment activity log — the patient_activities
  // "patient_deleted" entry below is the audit trail for this whole event.
  // `deleted_by`/`delete_reason` are mandatory together with `deleted_at`
  // (appointments_soft_delete_consistent, added Sprint 28C.1 after this
  // cascade was first written) — omitting them silently violated the CHECK
  // constraint and the appointments were never actually deleted.
  const { error: appointmentsError } = await supabase
    .from("appointments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: staffMember.userId,
      delete_reason: "Hasta kaydı silindiği için otomatik silindi.",
      updated_by: staffMember.userId,
    })
    .eq("patient_id", patientId)
    .is("deleted_at", null)

  if (appointmentsError) return { error: "Hasta silindi ancak randevuları silinemedi." }

  await supabase.from("patient_activities").insert({
    clinic_id: staffMember.clinicId,
    patient_id: patientId,
    activity_type: "patient_deleted",
    description: PATIENT_ACTIVITY_LABELS.patient_deleted,
    created_by: staffMember.userId,
  })

  revalidatePath("/patients")
  revalidatePath("/appointments")
  redirect("/patients")
}

export type PatientImportPreviewRow = PatientImportRow

export type PatientImportPreviewResult =
  | { error: string }
  | { validRows: PatientImportPreviewRow[]; errors: PatientImportRowError[]; totalRows: number }

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 500

export async function previewPatientImport(formData: FormData): Promise<PatientImportPreviewResult> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { error: "Bir dosya seçin." }
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { error: "Dosya boyutu 5MB'ı geçemez." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { validRows, errors, totalRows } = await parsePatientsWorkbook(buffer)

  if (validRows.length > MAX_IMPORT_ROWS) {
    return { error: `Tek seferde en fazla ${MAX_IMPORT_ROWS} kayıt içe aktarılabilir.` }
  }

  return { validRows, errors, totalRows }
}

export async function commitPatientImport(
  rows: PatientImportPreviewRow[],
): Promise<{ error?: string; imported?: number }> {
  if (rows.length === 0) return { error: "İçe aktarılacak kayıt yok." }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Tek seferde en fazla ${MAX_IMPORT_ROWS} kayıt içe aktarılabilir.` }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()

  const { data: insertedPatients, error } = await supabase
    .from("patients")
    .insert(
      rows.map((row) => ({
        clinic_id: staffMember.clinicId,
        full_name: row.fullName,
        phone: row.phone,
        email: row.email,
        date_of_birth: row.dateOfBirth,
        created_by: staffMember.userId,
        updated_by: staffMember.userId,
      })),
    )
    .select("id")

  if (error || !insertedPatients) {
    return {
      error:
        "İçe aktarma başarısız oldu. Dosyadaki bir telefon numarası mevcut bir kayıtla çakışıyor olabilir.",
    }
  }

  const activities: PatientActivityInsert[] = insertedPatients.map((patient) => ({
    clinic_id: staffMember.clinicId,
    patient_id: patient.id,
    activity_type: "patient_created",
    description: "Excel içe aktarma ile oluşturuldu.",
    created_by: staffMember.userId,
  }))
  await supabase.from("patient_activities").insert(activities)

  revalidatePath("/patients")
  return { imported: insertedPatients.length }
}

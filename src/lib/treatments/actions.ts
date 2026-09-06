"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import {
  getActiveSeriesForPatient,
  getTreatmentSeriesDetail,
  type TreatmentSeriesDetail,
  type TreatmentSeriesListRow,
} from "@/lib/treatments/queries"
import { TREATMENT_ACTIVITY_LABELS, type TreatmentLifecycleStatus } from "@/lib/treatments/constants"
import {
  sessionFormSchema,
  standaloneTreatmentFormSchema,
  treatmentPaymentCorrectionSchema,
  treatmentPaymentFormSchema,
  treatmentSeriesFormSchema,
  updateTreatmentSeriesSchema,
  type SessionFormValues,
  type StandaloneTreatmentFormValues,
  type TreatmentPaymentCorrectionValues,
  type TreatmentPaymentFormValues,
  type TreatmentSeriesFormValues,
  type UpdateTreatmentSeriesValues,
} from "@/lib/treatments/schema"
import { localDateToDateString } from "@/lib/format/date"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

type TreatmentActivityInsert = Database["public"]["Tables"]["treatment_activities"]["Insert"]

export type TreatmentActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; seriesId?: string; error?: undefined }
  | undefined

function revalidatePatientPaths(patientId: string) {
  revalidatePath(`/patients/${patientId}`)
}

/**
 * Auto-closes a series once its last session is marked completed — extracted
 * so `addSessionToSeries` and `completeSession` share exactly one copy of
 * this rule instead of two independently-maintained ones.
 */
async function closeSeriesIfComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seriesId: string,
  totalSessions: number,
  completedCountAfter: number,
  seriesStatus: TreatmentLifecycleStatus,
  staffMember: { clinicId: string; userId: string },
) {
  if (completedCountAfter < totalSessions || seriesStatus !== "active") return

  await supabase
    .from("treatment_series")
    .update({ status: "completed", updated_by: staffMember.userId })
    .eq("id", seriesId)

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    series_id: seriesId,
    activity_type: "series_updated",
    description: "Paket tüm seanslar tamamlanarak kapatıldı.",
    created_by: staffMember.userId,
  })
}

/**
 * Client-callable wrapper around `getActiveSeriesForPatient` — the
 * appointment form's "Mevcut Paketten Devam Et" option (Sprint 13) fetches
 * this on demand (only once the "+ Tedavi Tanımla" section is opened for a
 * chosen patient), not as part of the page's initial data load.
 */
export async function fetchActiveSeriesForPatient(patientId: string): Promise<TreatmentSeriesListRow[]> {
  if (!patientId) return []
  return getActiveSeriesForPatient(patientId)
}

/**
 * Client-callable wrapper around `getTreatmentSeriesDetail` — the Dashboard's
 * "Bekleyen Bakiye" drill-down (Founder decision 2026-07-28) opens a package's
 * full detail/correction Sheet on demand from a table row, reusing the same
 * Sheet the patient card already uses instead of building a second payment
 * picker.
 */
export async function fetchTreatmentSeriesDetail(seriesId: string): Promise<TreatmentSeriesDetail | null> {
  return getTreatmentSeriesDetail(seriesId)
}

/** "Yeni Paket Oluştur" — a treatment_series with no session yet (see docs/DATABASE.md). */
export async function createTreatmentSeries(values: TreatmentSeriesFormValues): Promise<TreatmentActionState> {
  const parsed = treatmentSeriesFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: series, error } = await supabase
    .from("treatment_series")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: parsed.data.patientId,
      treatment_type: parsed.data.treatmentType,
      total_sessions: parsed.data.totalSessions,
      total_fee: parsed.data.totalFee ?? null,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (error || !series) {
    return { error: "Paket oluşturulamadı. Bilgileri kontrol edip tekrar deneyin." }
  }

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    series_id: series.id,
    activity_type: "series_created",
    description: `${TREATMENT_ACTIVITY_LABELS.series_created}: ${parsed.data.treatmentType} (${parsed.data.totalSessions} seans)`,
    created_by: staffMember.userId,
  })

  revalidatePatientPaths(parsed.data.patientId)
  return { success: true, seriesId: series.id }
}

function formatFeeForActivityLog(fee: number | null): string {
  return fee === null ? "Belirlenmedi" : `${fee.toLocaleString("tr-TR")} TRY`
}

/**
 * "Paket Düzenle" (Sprint 8) — treatmentType/totalSessions/totalFee are
 * editable any time after a package exists (8→10 seans, fee negotiated
 * later, etc.), not just at creation. Uses the same RLS UPDATE policy
 * `treatment_series_update_clinical_roles` already grants
 * owner/doctor/beauty_specialist (see `20260724090000_create_treatment_module.sql`)
 * — no RLS change needed, this was purely a missing application-layer
 * action. Every changed field logs its own before/after to
 * `treatment_activities`, never a silent update — same discipline as the
 * append-only payment ledger, applied to package edits.
 */
export async function updateTreatmentSeries(
  values: UpdateTreatmentSeriesValues,
): Promise<TreatmentActionState> {
  const parsed = updateTreatmentSeriesSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from("treatment_series")
    .select("patient_id, treatment_type, total_sessions, total_fee")
    .eq("id", parsed.data.seriesId)
    .maybeSingle()

  if (fetchError || !existing) return { error: "Paket bulunamadı." }

  const { count: completedCount } = await supabase
    .from("treatments")
    .select("*", { count: "exact", head: true })
    .eq("series_id", parsed.data.seriesId)
    .eq("status", "completed")

  if ((completedCount ?? 0) > parsed.data.totalSessions) {
    return {
      error: `Bu pakette ${completedCount} tamamlanmış seans var — seans sayısı bundan az olamaz.`,
      fieldErrors: { totalSessions: "Tamamlanan seans sayısından az olamaz." },
    }
  }

  const newFee = parsed.data.totalFee ?? null

  const { error: updateError } = await supabase
    .from("treatment_series")
    .update({
      treatment_type: parsed.data.treatmentType,
      total_sessions: parsed.data.totalSessions,
      total_fee: newFee,
      updated_by: staffMember.userId,
    })
    .eq("id", parsed.data.seriesId)

  if (updateError) {
    return { error: "Paket güncellenemedi. Bu işlem için yetkiniz olmayabilir." }
  }

  const activities: TreatmentActivityInsert[] = []
  if (existing.treatment_type !== parsed.data.treatmentType) {
    activities.push({
      clinic_id: staffMember.clinicId,
      series_id: parsed.data.seriesId,
      activity_type: "series_updated",
      description: `İşlem adı güncellendi: "${existing.treatment_type}" → "${parsed.data.treatmentType}"`,
      created_by: staffMember.userId,
    })
  }
  if (existing.total_sessions !== parsed.data.totalSessions) {
    activities.push({
      clinic_id: staffMember.clinicId,
      series_id: parsed.data.seriesId,
      activity_type: "series_updated",
      description: `Seans sayısı güncellendi: ${existing.total_sessions} → ${parsed.data.totalSessions}`,
      created_by: staffMember.userId,
    })
  }
  if ((existing.total_fee ?? null) !== newFee) {
    activities.push({
      clinic_id: staffMember.clinicId,
      series_id: parsed.data.seriesId,
      activity_type: "series_updated",
      description: `Ücret güncellendi: ${formatFeeForActivityLog(existing.total_fee)} → ${formatFeeForActivityLog(newFee)}`,
      created_by: staffMember.userId,
    })
  }
  if (activities.length > 0) {
    await supabase.from("treatment_activities").insert(activities)
  }

  revalidatePatientPaths(existing.patient_id)
  return { success: true, seriesId: parsed.data.seriesId }
}

/**
 * "Yeni Tedavi" (tek seferlik) — creates an invisible size-1 series and its
 * one session together. If the session insert fails after the series
 * already succeeded, the orphan series is marked `voided` (never deleted —
 * see docs/DATABASE.md "No soft delete on the Treatment Module") rather than
 * left as a confusing empty "package."
 */
export async function createStandaloneTreatment(
  values: StandaloneTreatmentFormValues,
): Promise<TreatmentActionState> {
  const parsed = standaloneTreatmentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: series, error: seriesError } = await supabase
    .from("treatment_series")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: parsed.data.patientId,
      treatment_type: parsed.data.treatmentType,
      total_sessions: 1,
      total_fee: parsed.data.totalFee ?? null,
      status: parsed.data.status === "cancelled" ? "cancelled" : "active",
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (seriesError || !series) {
    return { error: "Tedavi kaydı oluşturulamadı. Bilgileri kontrol edip tekrar deneyin." }
  }

  const { data: treatment, error: treatmentError } = await supabase
    .from("treatments")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: parsed.data.patientId,
      series_id: series.id,
      staff_id: parsed.data.staffId,
      appointment_id: parsed.data.appointmentId || null,
      session_number: 1,
      treatment_date: parsed.data.treatmentDate,
      description: parsed.data.description || null,
      control_date: parsed.data.controlDate || null,
      status: parsed.data.status,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (treatmentError || !treatment) {
    await supabase
      .from("treatment_series")
      .update({ status: "voided", updated_by: staffMember.userId })
      .eq("id", series.id)
    return { error: "Tedavi kaydı oluşturulamadı. Bilgileri kontrol edip tekrar deneyin." }
  }

  const activities: TreatmentActivityInsert[] = [
    {
      clinic_id: staffMember.clinicId,
      series_id: series.id,
      activity_type: "series_created",
      description: `${TREATMENT_ACTIVITY_LABELS.series_created}: ${parsed.data.treatmentType}`,
      created_by: staffMember.userId,
    },
    {
      clinic_id: staffMember.clinicId,
      treatment_id: treatment.id,
      activity_type: "treatment_created",
      description: TREATMENT_ACTIVITY_LABELS.treatment_created,
      created_by: staffMember.userId,
    },
  ]
  await supabase.from("treatment_activities").insert(activities)

  revalidatePatientPaths(parsed.data.patientId)
  return { success: true, seriesId: series.id }
}

/**
 * "Pakete Seans Ekle" — a new session on an existing series. If this session
 * completes the series (status `completed` and every session up to
 * `total_sessions` is now recorded), the series itself flips to `completed`
 * — application-layer logic, not a DB trigger, matching this project's
 * existing precedent for status transitions.
 */
export async function addSessionToSeries(values: SessionFormValues): Promise<TreatmentActionState> {
  const parsed = sessionFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const seriesDetail = await getTreatmentSeriesDetail(parsed.data.seriesId)
  if (!seriesDetail) return { error: "Paket bulunamadı." }

  const supabase = await createClient()

  const { data: treatment, error: treatmentError } = await supabase
    .from("treatments")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: seriesDetail.patientId,
      series_id: parsed.data.seriesId,
      staff_id: parsed.data.staffId,
      appointment_id: parsed.data.appointmentId || null,
      session_number: parsed.data.sessionNumber,
      treatment_date: parsed.data.treatmentDate,
      description: parsed.data.description || null,
      control_date: parsed.data.controlDate || null,
      status: parsed.data.status,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (treatmentError || !treatment) {
    return { error: "Seans eklenemedi. Bilgileri kontrol edip tekrar deneyin." }
  }

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    treatment_id: treatment.id,
    activity_type: "treatment_created",
    description: `${TREATMENT_ACTIVITY_LABELS.treatment_created} (${parsed.data.sessionNumber}. seans)`,
    created_by: staffMember.userId,
  })

  const completedAfterThis = seriesDetail.completedSessions + (parsed.data.status === "completed" ? 1 : 0)
  await closeSeriesIfComplete(
    supabase,
    parsed.data.seriesId,
    seriesDetail.totalSessions,
    completedAfterThis,
    seriesDetail.status,
    staffMember,
  )

  revalidatePatientPaths(seriesDetail.patientId)
  return { success: true, seriesId: parsed.data.seriesId }
}

/**
 * "Bugünkü seansı tamamla" (mini sprint) — the fast path: the user only
 * confirms which session number is done, never fills a form. Sequential
 * completion is enforced here, not just suggested in the UI — completing
 * session N before N-1 exists returns a clear warning instead of writing
 * anything, so a misclick can never create a gap in the package's history.
 * If a session was already pre-scheduled (e.g. via "Seans Ekle" as
 * `active`), its existing row is updated in place — real staff/date/
 * description are preserved, only `status` flips. Otherwise a new row is
 * inserted with the acting staff member and today's date, exactly per
 * "kullanıcı asla insert/update görmemeli" — no field is ever asked for.
 */
export async function completeSession(
  seriesId: string,
  sessionNumber: number,
): Promise<TreatmentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: series, error: seriesError } = await supabase
    .from("treatment_series")
    .select("id, patient_id, total_sessions, status")
    .eq("id", seriesId)
    .maybeSingle()

  if (seriesError) throw seriesError
  if (!series) return { error: "Paket bulunamadı." }
  if (series.status !== "active") return { error: "Bu paket artık aktif değil." }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("treatments")
    .select("id, session_number, status")
    .eq("series_id", seriesId)
    .neq("status", "voided")

  if (sessionsError) throw sessionsError

  const completedCount = (sessionRows ?? []).filter((row) => row.status === "completed").length
  const nextNumber = completedCount + 1

  if (sessionNumber !== nextNumber) {
    return { error: `Önce ${nextNumber}. seansı tamamlamalısınız.` }
  }

  const existing = (sessionRows ?? []).find(
    (row) => row.session_number === sessionNumber && row.status === "active",
  )

  let treatmentId: string

  if (existing) {
    const { error } = await supabase
      .from("treatments")
      .update({ status: "completed", updated_by: staffMember.userId })
      .eq("id", existing.id)
    if (error) return { error: "Seans tamamlanamadı." }
    treatmentId = existing.id
  } else {
    const { data: inserted, error } = await supabase
      .from("treatments")
      .insert({
        clinic_id: staffMember.clinicId,
        patient_id: series.patient_id,
        series_id: seriesId,
        staff_id: staffMember.userId,
        session_number: sessionNumber,
        treatment_date: localDateToDateString(new Date()),
        status: "completed",
        created_by: staffMember.userId,
        updated_by: staffMember.userId,
      })
      .select("id")
      .single()
    if (error || !inserted) return { error: "Seans tamamlanamadı." }
    treatmentId = inserted.id
  }

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    treatment_id: treatmentId,
    activity_type: "status_changed",
    description: `${sessionNumber}. seans tamamlandı.`,
    created_by: staffMember.userId,
  })

  await closeSeriesIfComplete(supabase, seriesId, series.total_sessions, nextNumber, series.status, staffMember)

  revalidatePatientPaths(series.patient_id)
  return { success: true, seriesId }
}

/** "Ödeme Ekle" — always `entry_type = 'payment'`. Owner/Secretary only, enforced by RLS. */
export async function recordPayment(values: TreatmentPaymentFormValues): Promise<TreatmentActionState> {
  const parsed = treatmentPaymentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: payment, error } = await supabase
    .from("treatment_payments")
    .insert({
      clinic_id: staffMember.clinicId,
      series_id: parsed.data.seriesId,
      amount: parsed.data.amount,
      entry_type: "payment",
      method: parsed.data.method,
      paid_at: parsed.data.paidAt,
      note: parsed.data.note || null,
      recorded_by: staffMember.userId,
    })
    .select("id, series_id")
    .single()

  if (error || !payment) {
    return { error: "Ödeme kaydedilemedi. Bu işlem için yetkiniz olmayabilir." }
  }

  // `series_id` is guaranteed non-null here — this insert always sets it
  // explicitly (only Sprint 28's new treatment_plan_id-attached rows leave
  // it null, and this legacy action never creates those).
  const { data: series } = await supabase
    .from("treatment_series")
    .select("patient_id")
    .eq("id", payment.series_id!)
    .maybeSingle()

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    series_id: payment.series_id,
    activity_type: "payment_recorded",
    description: `${TREATMENT_ACTIVITY_LABELS.payment_recorded}: ${parsed.data.amount.toLocaleString("tr-TR")} TRY`,
    metadata: { amount: parsed.data.amount, method: parsed.data.method },
    created_by: staffMember.userId,
  })

  if (series) revalidatePatientPaths(series.patient_id)
  return { success: true, seriesId: payment.series_id! }
}

/** "İade / Düzeltme" — always references the payment it corrects. */
export async function recordPaymentCorrection(
  values: TreatmentPaymentCorrectionValues,
): Promise<TreatmentActionState> {
  const parsed = treatmentPaymentCorrectionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: payment, error } = await supabase
    .from("treatment_payments")
    .insert({
      clinic_id: staffMember.clinicId,
      series_id: parsed.data.seriesId,
      related_payment_id: parsed.data.relatedPaymentId,
      amount: parsed.data.amount,
      entry_type: parsed.data.entryType,
      method: parsed.data.method,
      paid_at: parsed.data.paidAt,
      note: parsed.data.note || null,
      recorded_by: staffMember.userId,
    })
    .select("id, series_id")
    .single()

  if (error || !payment) {
    return { error: "Düzeltme kaydedilemedi. Bu işlem için yetkiniz olmayabilir." }
  }

  // `series_id` is guaranteed non-null here — see the same-shaped insert in
  // `recordPayment` above.
  const { data: series } = await supabase
    .from("treatment_series")
    .select("patient_id")
    .eq("id", payment.series_id!)
    .maybeSingle()

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    series_id: payment.series_id,
    activity_type: "payment_recorded",
    description: `${parsed.data.entryType === "refund" ? "İade" : "Düzeltme"}: ${parsed.data.amount.toLocaleString("tr-TR")} TRY`,
    metadata: { amount: parsed.data.amount, entry_type: parsed.data.entryType, related_payment_id: parsed.data.relatedPaymentId },
    created_by: staffMember.userId,
  })

  if (series) revalidatePatientPaths(series.patient_id)
  return { success: true, seriesId: payment.series_id! }
}

/**
 * "Paketi Geçersiz Say" (Founder decision 2026-07-28) — for a package created
 * by mistake (e.g. a duplicate single-session entry), sets it to `voided`
 * rather than deleting it: `voided` series are already excluded everywhere
 * (Dashboard totals, patient card, revenue drill-down) per docs/DATABASE.md,
 * so this removes it from every financial view without a real DELETE — its
 * row and history stay intact for audit purposes. Gated at the application
 * layer by `canManageTreatments` (owner/doctor/beauty_specialist), matching
 * `treatment_series_update_clinical_roles` (the RLS policy this UPDATE runs
 * under) rather than `canCorrectPayments` — voiding a package is a change to
 * the package itself, not a payment-ledger entry.
 */
export async function voidTreatmentSeries(seriesId: string): Promise<TreatmentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: series, error: fetchError } = await supabase
    .from("treatment_series")
    .select("patient_id, treatment_type, status")
    .eq("id", seriesId)
    .maybeSingle()

  if (fetchError || !series) return { error: "Paket bulunamadı." }
  if (series.status === "voided") return { error: "Bu paket zaten geçersiz kılınmış." }

  const { error: updateError } = await supabase
    .from("treatment_series")
    .update({ status: "voided", updated_by: staffMember.userId })
    .eq("id", seriesId)

  if (updateError) {
    return { error: "Paket geçersiz kılınamadı. Bu işlem için yetkiniz olmayabilir." }
  }

  await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    series_id: seriesId,
    activity_type: "series_updated",
    description: `Paket geçersiz kılındı: ${series.treatment_type}`,
    created_by: staffMember.userId,
  })

  revalidatePatientPaths(series.patient_id)
  revalidatePath("/dashboard")
  return { success: true, seriesId }
}

/** Adds a note to a session's or a series' activity timeline — exactly one of the two must be given. */
export async function addTreatmentNote(
  target: { treatmentId: string; seriesId?: undefined } | { treatmentId?: undefined; seriesId: string },
  note: string,
  patientIdForRevalidate: string,
): Promise<TreatmentActionState> {
  const trimmed = note.trim()
  if (!trimmed) return { error: "Not boş olamaz." }
  if (trimmed.length > 2000) return { error: "Not 2000 karakteri geçemez." }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("treatment_activities").insert({
    clinic_id: staffMember.clinicId,
    treatment_id: target.treatmentId ?? null,
    series_id: target.seriesId ?? null,
    activity_type: "note_added",
    description: trimmed,
    created_by: staffMember.userId,
  })

  if (error) return { error: "Not eklenemedi." }

  revalidatePatientPaths(patientIdForRevalidate)
  return { success: true }
}

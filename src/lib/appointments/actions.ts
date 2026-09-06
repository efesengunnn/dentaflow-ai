"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { APPOINTMENT_ACTIVITY_LABELS, APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/constants"
import { findOverlappingAppointment } from "@/lib/appointments/queries"
import {
  parseAppointmentsWorkbook,
  type AppointmentImportRow,
  type AppointmentImportRowError,
} from "@/lib/appointments/import"
import { appointmentFormSchema, type AppointmentFormValues } from "@/lib/appointments/schema"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { istanbulWallClockToUTC } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { getAssignableStaff } from "@/lib/staff/queries"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { createTreatmentPlan } from "@/lib/treatment-plans/actions"
import { getRemainingSessionsForPatient } from "@/lib/treatment-plans/queries"
import { flattenZodError } from "@/lib/validation/zod"

type AppointmentActivityInsert = Database["public"]["Tables"]["appointment_activities"]["Insert"]

export type AppointmentActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; warning?: string; error?: undefined }
  | undefined

/**
 * Combines a `yyyy-mm-dd` date and an `HH:MM` time, understood as Europe/
 * Istanbul local time, into the correct UTC instant. This runs inside a
 * Server Action — never `new Date(year, month - 1, day, hour, minute)` here,
 * which would use the *server process's* timezone (Turkey-local on a dev
 * machine, but UTC on Vercel's production runtime) rather than the clinic's
 * actual timezone, silently shifting every stored appointment time by 3
 * hours in production. See `istanbulWallClockToUTC` (lib/format/date.ts).
 */
function combineDateAndTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  return istanbulWallClockToUTC(year, month, day, hour, minute)
}

function conflictErrorMessage(conflict: { patientName: string; startsAt: string }): string {
  // timeZone pinned explicitly — this formats server-side, and without it
  // the displayed hour follows the server process's own timezone (UTC on
  // Vercel), same class of bug as combineDateAndTime above.
  const startLabel = new Date(conflict.startsAt).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  })
  return `Seçilen sağlayıcının bu saatte zaten bir randevusu var: ${conflict.patientName} (${startLabel}). Lütfen farklı bir saat veya sağlayıcı seçin.`
}

export type CreateAppointmentResult =
  | { error: string; fieldErrors?: Record<string, string> }
  | { appointmentId: string; treatmentWarning?: string }

/**
 * "+ Tedavi Tanımla" orchestration — runs after the appointment itself is
 * already safely inserted, so a failure here never loses the appointment.
 * Sprint 30 — Provider-Based Treatment Flow: a fresh plan is never created
 * from here anymore. By the time the appointment form submits,
 * `treatmentPlanId`/`treatmentPlanItemId` are already resolved — either the
 * patient already had a plan item with remaining sessions, or the inline
 * treatment-plan builder (in the same Sheet) already created one and handed
 * back its id before this submit happened. This function's only job is
 * linking, the same one path for both cases.
 *
 * Only `appointments.treatment_plan_id`/`treatment_plan_item_id` are set
 * here — no `treatment_sessions` row is created at booking time (that's a
 * separate, later "seansı tamamla" action, deliberately out of scope).
 * Returns an error string to surface as a soft toast warning, never a hard
 * failure of the appointment itself.
 */
async function applyAppointmentTreatmentPlan(
  data: AppointmentFormValues,
  appointmentId: string,
): Promise<string | undefined> {
  if (!data.treatmentPlanId || !data.treatmentPlanItemId) return undefined

  const supabase = await createClient()

  // Defense-in-depth: the picker only ever offers items with remaining
  // sessions, but re-confirm here in case they were exhausted by another
  // booking in the meantime (see appointment-treatment-section.tsx).
  const remaining = await getRemainingSessionsForPatient(data.patientId)
  const stillHasRemaining = remaining.some((row) => row.itemId === data.treatmentPlanItemId)
  if (!stillHasRemaining) {
    return "Seçilen kalemde artık kalan seans yok, plana bağlanamadı."
  }
  const { error } = await supabase
    .from("appointments")
    .update({ treatment_plan_id: data.treatmentPlanId, treatment_plan_item_id: data.treatmentPlanItemId })
    .eq("id", appointmentId)
  return error ? "Randevu tedavi planına bağlanamadı." : undefined
}

/**
 * "Tek Seans / Tek İşlem" — Sprint 30.4 (founder decision, 2026-08-11): a
 * real, single-item treatment plan is created behind the scenes so the
 * existing payment ledger, "Aktif Tedavi Planı", and the owner's "Paketler"
 * screen all work completely unchanged — the user never sees a "paket"
 * concept anywhere in this flow, this is pure storage. Runs before the
 * appointment insert so the new item's id can be written directly, no
 * follow-up UPDATE needed; `applyAppointmentTreatmentPlan` below then links
 * it exactly like a pre-existing plan item picked from "Tanımlanmış Paket".
 * Returns `null` when this isn't a standalone-treatment submission at all.
 */
async function createHiddenPlanForStandaloneTreatment(
  data: AppointmentFormValues,
): Promise<{ treatmentPlanId: string; treatmentPlanItemId: string } | { warning: string } | null> {
  if (!data.standaloneTreatmentName) return null

  const result = await createTreatmentPlan({
    patientId: data.patientId,
    planName: data.standaloneTreatmentName,
    items: [
      {
        providerId: data.staffId,
        treatmentName: data.standaloneTreatmentName,
        sessionCount: 1,
        unitPrice: data.standalonePrice,
        controlDate: data.controlDate,
      },
    ],
  })

  if (!result || "error" in result) {
    return { warning: "Tedavi kaydı oluşturulamadı, randevu tedavisiz kaydedildi." }
  }
  return { treatmentPlanId: result.planId, treatmentPlanItemId: result.itemIds[0] }
}

/**
 * The actual insert logic, without the redirect — extracted so
 * `createPatient` (Sprint 8's "Aynı anda randevu oluştur" checkbox) can
 * reuse the exact same validation/overlap-check/insert/activity-log path
 * instead of duplicating it, while still deciding its own redirect target
 * (a combined patient+appointment submission redirects differently on
 * conflict than a standalone "Yeni Randevu" does). `createAppointment`
 * below is now a thin wrapper: same behavior as before for every existing
 * caller.
 */
export async function insertAppointment(values: AppointmentFormValues): Promise<CreateAppointmentResult> {
  const parsed = appointmentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const startsAt = combineDateAndTime(parsed.data.date, parsed.data.time)
  const startsAtISO = startsAt.toISOString()
  // No duration concept (founder decision, 2026-07-31) — an appointment is a
  // single point in time, ends_at is only still populated because the
  // column is NOT NULL at the DB level.
  const endsAtISO = startsAtISO

  const conflict = await findOverlappingAppointment(parsed.data.staffId, startsAtISO)
  if (conflict) {
    return { error: conflictErrorMessage(conflict), fieldErrors: { time: "Bu saatte çakışan bir randevu var." } }
  }

  // Checked before the appointment insert (never after) — a scheduling
  // conflict must never leave an orphan treatment plan with no appointment.
  const hiddenPlan = await createHiddenPlanForStandaloneTreatment(parsed.data)
  const hiddenPlanWarning = hiddenPlan && "warning" in hiddenPlan ? hiddenPlan.warning : undefined
  const effectiveData: AppointmentFormValues =
    hiddenPlan && "treatmentPlanId" in hiddenPlan
      ? {
          ...parsed.data,
          treatmentPlanId: hiddenPlan.treatmentPlanId,
          treatmentPlanItemId: hiddenPlan.treatmentPlanItemId,
          standaloneTreatmentName: "",
          standalonePrice: undefined,
        }
      : parsed.data

  const supabase = await createClient()
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: effectiveData.patientId,
      staff_id: effectiveData.staffId,
      reason: effectiveData.reason || null,
      starts_at: startsAtISO,
      ends_at: endsAtISO,
      status: effectiveData.status,
      // Only ever populated when the hidden-plan creation above failed —
      // the fallback so the appointment itself is never lost over it.
      standalone_treatment_name: effectiveData.standaloneTreatmentName || null,
      standalone_price: effectiveData.standalonePrice ?? null,
      control_date: effectiveData.controlDate || null,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (error || !appointment) {
    return { error: "Randevu oluşturulamadı. Bilgileri kontrol edip tekrar deneyin." }
  }

  const activities: AppointmentActivityInsert[] = [
    {
      clinic_id: staffMember.clinicId,
      appointment_id: appointment.id,
      activity_type: "appointment_created",
      description: APPOINTMENT_ACTIVITY_LABELS.appointment_created,
      created_by: staffMember.userId,
    },
  ]
  if (effectiveData.note?.trim()) {
    activities.push({
      clinic_id: staffMember.clinicId,
      appointment_id: appointment.id,
      activity_type: "note_added",
      description: effectiveData.note.trim(),
      created_by: staffMember.userId,
    })
  }
  await supabase.from("appointment_activities").insert(activities)

  const linkWarning = await applyAppointmentTreatmentPlan(effectiveData, appointment.id)

  revalidatePath("/appointments")
  revalidatePath(`/patients/${effectiveData.patientId}`)
  return { appointmentId: appointment.id, treatmentWarning: hiddenPlanWarning ?? linkWarning }
}

export async function createAppointment(values: AppointmentFormValues): Promise<AppointmentActionState> {
  const result = await insertAppointment(values)
  if ("error" in result) return result
  const query = result.treatmentWarning ? `?tedaviHata=${encodeURIComponent(result.treatmentWarning)}` : ""
  redirect(`/appointments/${result.appointmentId}${query}`)
}

export async function updateAppointment(
  appointmentId: string,
  values: AppointmentFormValues,
): Promise<AppointmentActionState> {
  const parsed = appointmentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("appointments")
    .select("patient_id, staff_id, reason, starts_at, status")
    .eq("id", appointmentId)
    .single()

  if (!existing) return { error: "Randevu bulunamadı." }

  const startsAt = combineDateAndTime(parsed.data.date, parsed.data.time)
  const startsAtISO = startsAt.toISOString()
  // No duration concept (founder decision, 2026-07-31) — ends_at is only
  // still populated because the column is NOT NULL at the DB level.
  const endsAtISO = startsAtISO

  const conflict = await findOverlappingAppointment(parsed.data.staffId, startsAtISO, appointmentId)
  if (conflict) {
    return { error: conflictErrorMessage(conflict), fieldErrors: { time: "Bu saatte çakışan bir randevu var." } }
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: parsed.data.patientId,
      staff_id: parsed.data.staffId,
      reason: parsed.data.reason || null,
      starts_at: startsAtISO,
      ends_at: endsAtISO,
      status: parsed.data.status,
      updated_by: staffMember.userId,
    })
    .eq("id", appointmentId)

  if (error) return { error: "Randevu güncellenemedi." }

  const activities: AppointmentActivityInsert[] = []

  if (existing.status !== parsed.data.status) {
    activities.push({
      clinic_id: staffMember.clinicId,
      appointment_id: appointmentId,
      activity_type: "status_changed",
      description: `Durum "${APPOINTMENT_STATUS_LABELS[existing.status]}" durumundan "${APPOINTMENT_STATUS_LABELS[parsed.data.status]}" durumuna değiştirildi.`,
      metadata: { from_status: existing.status, to_status: parsed.data.status },
      created_by: staffMember.userId,
    })
  }

  const otherFieldsChanged =
    existing.patient_id !== parsed.data.patientId ||
    existing.staff_id !== parsed.data.staffId ||
    (existing.reason ?? "") !== (parsed.data.reason ?? "") ||
    existing.starts_at !== startsAtISO

  if (otherFieldsChanged) {
    activities.push({
      clinic_id: staffMember.clinicId,
      appointment_id: appointmentId,
      activity_type: "appointment_updated",
      description: APPOINTMENT_ACTIVITY_LABELS.appointment_updated,
      created_by: staffMember.userId,
    })
  }

  if (parsed.data.note?.trim()) {
    activities.push({
      clinic_id: staffMember.clinicId,
      appointment_id: appointmentId,
      activity_type: "note_added",
      description: parsed.data.note.trim(),
      created_by: staffMember.userId,
    })
  }

  if (activities.length) {
    await supabase.from("appointment_activities").insert(activities)
  }

  revalidatePath("/appointments")
  revalidatePath(`/appointments/${appointmentId}`)
  revalidatePath(`/patients/${parsed.data.patientId}`)
  return { success: true }
}

export async function addAppointmentNote(
  appointmentId: string,
  note: string,
): Promise<AppointmentActionState> {
  const trimmed = note.trim()
  if (!trimmed) return { error: "Not boş olamaz." }
  if (trimmed.length > 2000) return { error: "Not 2000 karakteri geçemez." }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("appointment_activities").insert({
    clinic_id: staffMember.clinicId,
    appointment_id: appointmentId,
    activity_type: "note_added",
    description: trimmed,
    created_by: staffMember.userId,
  })

  if (error) return { error: "Not eklenemedi." }

  revalidatePath(`/appointments/${appointmentId}`)
  return { success: true }
}

const APPOINTMENT_DEFAULT_DELETE_REASON = "Randevu ekranından silindi."

/**
 * Core soft-delete, no redirect — same "insertX / createX" split as
 * `insertAppointment`/`createAppointment` above. Used directly by list-row
 * "Sil" actions (`AppointmentAgendaList`) that need to stay on the current
 * page; `softDeleteAppointment` below wraps this for the Appointment
 * Detail page's own header action, where navigating away afterward is
 * correct (the page you were on no longer has anything to show).
 *
 * Sprint 28C.1 (Flexible Delete & Audit) rewrite of the 2026-07-31
 * founder-decision behavior below: a linked treatment/session is **never**
 * a hard block anymore, and this appointment's own soft-delete never mutates
 * any linked clinical/financial row — completed history, `treatment_series`/
 * `treatments` phantom-cleanup aside, is left exactly as it was. Instead a
 * `warning` string is returned for the caller to surface. `reason` is
 * optional here only because neither current caller (`AppointmentAgendaList`,
 * `AppointmentDeleteDialog`) collects one yet from the user — a system
 * default is used so `delete_reason` is never left null (the DB CHECK
 * requires it whenever `deleted_at` is set).
 */
export async function removeAppointment(appointmentId: string, reason?: string): Promise<AppointmentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const deleteReason = reason?.trim() || APPOINTMENT_DEFAULT_DELETE_REASON

  let warning: string | undefined

  // Legacy treatments/treatment_series link (pre-Sprint 28 bookings).
  const { data: linkedTreatment } = await supabase
    .from("treatments")
    .select("id, series_id, status")
    .eq("appointment_id", appointmentId)
    .neq("status", "voided")
    .maybeSingle()

  if (linkedTreatment?.status === "completed") {
    warning =
      "Bu randevuya bağlı tamamlanmış bir tedavi seansı bulunmaktadır. Silme işlemi geçmiş kayıtları gizler ancak audit kaydı korunur."
  } else if (linkedTreatment) {
    const { count: paymentCount } = await supabase
      .from("treatment_payments")
      .select("*", { count: "exact", head: true })
      .eq("series_id", linkedTreatment.series_id)

    if ((paymentCount ?? 0) > 0) {
      warning =
        "Bu randevuya bağlı tedavi paketi için ödeme kaydı bulunmaktadır. Silme işlemi geçmiş kayıtları gizler ancak audit kaydı korunur."
    } else {
      // No payment, not completed — this is the "invisible size-1 series"
      // phantom-cleanup case (same as `createStandaloneTreatment`'s own
      // failure path): never a real event, safe to void without a warning.
      await supabase
        .from("treatments")
        .update({ status: "voided", updated_by: staffMember.userId })
        .eq("id", linkedTreatment.id)

      await supabase.from("treatment_activities").insert({
        clinic_id: staffMember.clinicId,
        treatment_id: linkedTreatment.id,
        activity_type: "status_changed",
        description: "Bağlı randevu silindiği için tedavi geçersiz kılındı.",
        created_by: staffMember.userId,
      })

      const { count: remainingCount } = await supabase
        .from("treatments")
        .select("*", { count: "exact", head: true })
        .eq("series_id", linkedTreatment.series_id)
        .neq("status", "voided")

      if ((remainingCount ?? 0) === 0) {
        await supabase
          .from("treatment_series")
          .update({ status: "voided", updated_by: staffMember.userId })
          .eq("id", linkedTreatment.series_id)

        await supabase.from("treatment_activities").insert({
          clinic_id: staffMember.clinicId,
          series_id: linkedTreatment.series_id,
          activity_type: "series_updated",
          description: "Bağlı randevu silindiği için paket geçersiz kılındı.",
          created_by: staffMember.userId,
        })
      }
    }
  }

  // New treatment_plan_item link (Sprint 28C+ bookings) — previously
  // entirely unguarded, closed here as part of this rewrite. Unlike the
  // legacy branch above, nothing is ever voided/mutated on this path: a
  // treatment_sessions row only ever exists once a visit was actually
  // performed, so there is no "phantom placeholder" to clean up — only
  // real history to warn about, or nothing at all.
  if (!warning) {
    // treatment_sessions.appointment_id is its own independent nullable FK —
    // checked regardless of whether *this* appointment's own
    // treatment_plan_item_id happens to be set, since nothing in the schema
    // guarantees the two always agree.
    const { count: completedSessionCount } = await supabase
      .from("treatment_sessions")
      .select("*", { count: "exact", head: true })
      .eq("appointment_id", appointmentId)
      .eq("status", "completed")
      .is("deleted_at", null)

    if ((completedSessionCount ?? 0) > 0) {
      warning =
        "Bu randevuya bağlı tamamlanmış bir tedavi seansı bulunmaktadır. Silme işlemi geçmiş kayıtları gizler ancak audit kaydı korunur."
    } else {
      const { data: planLink } = await supabase
        .from("appointments")
        .select("treatment_plan_id")
        .eq("id", appointmentId)
        .maybeSingle()

      if (planLink?.treatment_plan_id) {
        const { count: planPaymentCount } = await supabase
          .from("treatment_payments")
          .select("*", { count: "exact", head: true })
          .eq("treatment_plan_id", planLink.treatment_plan_id)

        if ((planPaymentCount ?? 0) > 0) {
          warning =
            "Bu randevunun bağlı olduğu tedavi planı için ödeme kaydı bulunmaktadır. Silme işlemi geçmiş kayıtları gizler ancak audit kaydı korunur."
        }
      }
    }
  }

  // Soft-delete only — treatment_sessions.appointment_id is never touched,
  // so a completed session's link to this appointment survives intact
  // (founder decision, Sprint 28C.1).
  const { data: appointment, error } = await supabase
    .from("appointments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: staffMember.userId,
      delete_reason: deleteReason,
      updated_by: staffMember.userId,
    })
    .eq("id", appointmentId)
    .select("patient_id")
    .single()

  if (error || !appointment) return { error: "Randevu silinemedi." }

  await supabase.from("appointment_activities").insert({
    clinic_id: staffMember.clinicId,
    appointment_id: appointmentId,
    activity_type: "appointment_deleted",
    description: `${APPOINTMENT_ACTIVITY_LABELS.appointment_deleted}: ${deleteReason}`,
    created_by: staffMember.userId,
  })

  revalidatePath("/appointments")
  revalidatePath(`/patients/${appointment.patient_id}`)
  return { success: true, warning }
}

export async function softDeleteAppointment(appointmentId: string, reason?: string): Promise<AppointmentActionState> {
  const result = await removeAppointment(appointmentId, reason)
  if (result?.error) return result
  redirect("/appointments")
}

export type AppointmentImportPreviewRow = AppointmentImportRow & {
  patientId: string
  staffId: string
}

export type AppointmentImportPreviewResult =
  | { error: string }
  | { validRows: AppointmentImportPreviewRow[]; errors: AppointmentImportRowError[]; totalRows: number }

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 500

/**
 * Reads and validates an uploaded .xlsx, then resolves each row's patient
 * phone / provider name to real ids — a row that fails either lookup
 * becomes an error here (not a valid row), same "never bulk-write
 * unvalidated data" two-step discipline as Leads/Patients import, but with
 * two required foreign keys to resolve instead of one optional one.
 */
export async function previewAppointmentImport(
  formData: FormData,
): Promise<AppointmentImportPreviewResult> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { error: "Bir dosya seçin." }
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { error: "Dosya boyutu 5MB'ı geçemez." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { validRows, errors, totalRows } = await parseAppointmentsWorkbook(buffer)

  if (validRows.length > MAX_IMPORT_ROWS) {
    return { error: `Tek seferde en fazla ${MAX_IMPORT_ROWS} kayıt içe aktarılabilir.` }
  }

  const supabase = await createClient()

  const phones = [...new Set(validRows.map((row) => row.patientPhone))]
  const { data: matchedPatients } =
    phones.length > 0
      ? await supabase
          .from("patients")
          .select("id, phone")
          .in("phone", phones)
          .is("deleted_at", null)
      : { data: [] }
  const patientIdByPhone = new Map((matchedPatients ?? []).map((row) => [row.phone, row.id]))

  const staffOptions = await getAssignableStaff()
  const staffIdByName = new Map(
    staffOptions.map((staff) => [staff.fullName.trim().toLocaleLowerCase("tr"), staff.id]),
  )

  const resolvedRows: AppointmentImportPreviewRow[] = []
  const resolutionErrors: AppointmentImportRowError[] = [...errors]

  for (const row of validRows) {
    const patientId = patientIdByPhone.get(row.patientPhone)
    if (!patientId) {
      resolutionErrors.push({
        rowNumber: row.rowNumber,
        message: `Bu telefon numarasıyla kayıtlı hasta bulunamadı: ${formatTurkishPhoneDisplay(row.patientPhone)}`,
      })
      continue
    }

    const staffId = staffIdByName.get(row.staffName.trim().toLocaleLowerCase("tr"))
    if (!staffId) {
      resolutionErrors.push({
        rowNumber: row.rowNumber,
        message: `Bu isimle personel bulunamadı: ${row.staffName}`,
      })
      continue
    }

    resolvedRows.push({ ...row, patientId, staffId })
  }

  return { validRows: resolvedRows, errors: resolutionErrors, totalRows }
}

export type AppointmentImportCommitResult = {
  error?: string
  imported?: number
  failed?: number
  failureMessages?: string[]
}

/**
 * Second, explicit commit step. Inserted one row at a time rather than one
 * bulk `.insert()` (unlike `commitLeadImport`/`commitPatientImport`) because
 * each row needs its own overlap check first — a batch bounded at
 * `MAX_IMPORT_ROWS` (500) keeps this an acceptable, infrequent-admin-action
 * cost, not a hot-path concern. A single failing row (conflict or insert
 * error) is skipped and reported, never aborts the rest of the file.
 */
export async function commitAppointmentImport(
  rows: AppointmentImportPreviewRow[],
): Promise<AppointmentImportCommitResult> {
  if (rows.length === 0) return { error: "İçe aktarılacak kayıt yok." }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Tek seferde en fazla ${MAX_IMPORT_ROWS} kayıt içe aktarılabilir.` }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const insertedIds: string[] = []
  const failureMessages: string[] = []

  for (const row of rows) {
    const startsAt = combineDateAndTime(row.date, row.time)
    const startsAtISO = startsAt.toISOString()
    // No duration concept (founder decision, 2026-07-31) — ends_at is only
    // still populated because the column is NOT NULL at the DB level.
    const endsAtISO = startsAtISO

    const conflict = await findOverlappingAppointment(row.staffId, startsAtISO)
    if (conflict) {
      failureMessages.push(`Satır ${row.rowNumber}: seçilen sağlayıcı için bu saatte zaten bir randevu var.`)
      continue
    }

    const { data: inserted, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: staffMember.clinicId,
        patient_id: row.patientId,
        staff_id: row.staffId,
        reason: row.reason,
        starts_at: startsAtISO,
        ends_at: endsAtISO,
        status: row.status,
        created_by: staffMember.userId,
        updated_by: staffMember.userId,
      })
      .select("id")
      .single()

    if (error || !inserted) {
      failureMessages.push(`Satır ${row.rowNumber}: kayıt oluşturulamadı.`)
      continue
    }

    insertedIds.push(inserted.id)
  }

  if (insertedIds.length > 0) {
    const activities: AppointmentActivityInsert[] = insertedIds.map((id) => ({
      clinic_id: staffMember.clinicId,
      appointment_id: id,
      activity_type: "appointment_created",
      description: "Excel içe aktarma ile oluşturuldu.",
      created_by: staffMember.userId,
    }))
    await supabase.from("appointment_activities").insert(activities)
  }

  revalidatePath("/appointments")
  return { imported: insertedIds.length, failed: failureMessages.length, failureMessages }
}

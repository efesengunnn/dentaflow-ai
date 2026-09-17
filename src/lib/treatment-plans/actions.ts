"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import type { Database } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { TREATMENT_PAYMENT_ENTRY_TYPE_LABELS } from "@/lib/treatment-plans/constants"
import {
  canCompleteSession,
  canCorrectOrVoidSession,
  canCorrectPayment,
  canCreateTreatmentPlan,
  canDeleteTreatmentPlan,
  canDeleteTreatmentPlanItem,
  canDeleteTreatmentSession,
  canRecordPayment,
  canReviseTreatmentPlan,
} from "@/lib/treatment-plans/permissions"
import {
  getRemainingSessionsForPatient,
  getTreatmentPlanDetail,
  type RemainingSessionItem,
  type TreatmentPlanDetail,
} from "@/lib/treatment-plans/queries"
import {
  completeSessionFormSchema,
  correctSessionFormSchema,
  deleteTreatmentPlanItemSchema,
  deleteTreatmentPlanSchema,
  deleteTreatmentSessionSchema,
  reviseTreatmentPlanItemSchema,
  treatmentPlanFormSchema,
  treatmentPlanPaymentCorrectionSchema,
  treatmentPlanPaymentFormSchema,
  voidSessionFormSchema,
  type CompleteSessionFormValues,
  type CorrectSessionFormValues,
  type DeleteTreatmentPlanItemValues,
  type DeleteTreatmentPlanValues,
  type DeleteTreatmentSessionValues,
  type ReviseTreatmentPlanItemValues,
  type TreatmentPlanFormValues,
  type TreatmentPlanPaymentCorrectionValues,
  type TreatmentPlanPaymentFormValues,
  type VoidSessionFormValues,
} from "@/lib/treatment-plans/schema"
import { flattenZodError } from "@/lib/validation/zod"

type TreatmentActivityInsert = Database["public"]["Tables"]["treatment_activities"]["Insert"]

export type TreatmentPlanActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; planId: string; itemIds: string[]; error?: undefined }
  | undefined

export type UpdateTreatmentPlanItemActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; revisionNo: number; error?: undefined }
  | undefined

export type DeleteTreatmentActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

/** Shared by `completeTreatmentSession`/`correctTreatmentSession` — both produce a new `treatment_sessions` row. */
export type SessionActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; sessionId: string; sessionNumber: number; error?: undefined }
  | undefined

export type RecordTreatmentPlanPaymentActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; paymentId: string; error?: undefined }
  | undefined

function revalidatePatientPaths(patientId: string) {
  revalidatePath(`/patients/${patientId}`)
}

/**
 * `canCreateTreatmentPlan`/`canReviseTreatmentPlan` (lib/treatment-plans/permissions.ts)
 * only branch on `role` — `hasFinancialAccess` is irrelevant to either check,
 * so it's never fetched here (one fewer RPC round trip per action call).
 */
function actorFrom(staffMember: { userId: string; role: Parameters<typeof canCreateTreatmentPlan>[0]["role"] }) {
  return { staffId: staffMember.userId, role: staffMember.role, hasFinancialAccess: false }
}

/**
 * Client-callable wrapper around `getTreatmentPlanDetail` — the Dashboard's
 * "Bekleyen Bakiye" / "Bu Ay Toplam Ciro" drill-downs open a plan's full
 * detail/correction Sheet on demand from a table row (Sprint 32), the
 * new-model analogue of `fetchTreatmentSeriesDetail`. RLS scopes the read to
 * the caller's own clinic; the drill-down itself is only reachable by a
 * `financial_access` holder.
 */
export async function fetchTreatmentPlanDetail(planId: string): Promise<TreatmentPlanDetail | null> {
  return getTreatmentPlanDetail(planId)
}

/**
 * "Yeni Tedavi Planı" wizard's Kaydet action. No DB transaction wrapper —
 * this codebase has never used one (see `createStandaloneTreatment` in
 * `lib/treatments/actions.ts`); the same compensating-action pattern is
 * used here instead: the plan is inserted first, then every item in one
 * batch `insert()` call (atomic among themselves — Postgres either inserts
 * all rows or none), and if that batch fails the plan is voided rather than
 * left as a phantom empty row. `total_price` equals the treatment's flat
 * price (`unitPrice`) — session count does NOT multiply it (founder decision
 * 2026-09-13: a treatment has one price regardless of how many visits it
 * takes). Computed here, never trusted from the client.
 */
export async function createTreatmentPlan(values: TreatmentPlanFormValues): Promise<TreatmentPlanActionState> {
  const parsed = treatmentPlanFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canCreateTreatmentPlan(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: parsed.data.patientId,
      plan_name: parsed.data.planName,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (planError || !plan) {
    return { error: "Tedavi planı oluşturulamadı. Lütfen tekrar deneyin." }
  }

  const itemRows = parsed.data.items.map((item) => ({
    clinic_id: staffMember.clinicId,
    patient_id: parsed.data.patientId,
    treatment_plan_id: plan.id,
    provider_id: item.providerId,
    treatment_name: item.treatmentName,
    catalog_item_id: item.catalogItemId || null,
    session_count: item.sessionCount,
    unit_price: item.unitPrice ?? null,
    total_price: item.unitPrice ?? null,
    currency: item.currency,
    control_date: item.controlDate || null,
    tooth_numbers: item.toothNumbers && item.toothNumbers.length > 0 ? item.toothNumbers : null,
    created_by: staffMember.userId,
    updated_by: staffMember.userId,
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from("treatment_plan_items")
    .insert(itemRows)
    .select("id")

  if (itemsError || !insertedItems) {
    await supabase
      .from("treatment_plans")
      .update({ status: "voided", updated_by: staffMember.userId })
      .eq("id", plan.id)
    return { error: "Tedavi kalemleri kaydedilemedi. Geçersiz bir sağlayıcı seçilmiş olabilir." }
  }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_plan_id: plan.id,
    // `plan_created` has no matching `treatment_activity_type` enum value —
    // this reuses `series_created` (the closest existing semantic match, and
    // what the Sprint 28A backfill migration already uses for migrated
    // plans) rather than adding a new enum value this sprint.
    activity_type: "series_created",
    description: `Tedavi planı oluşturuldu: ${parsed.data.planName}`,
    metadata: { item_count: parsed.data.items.length },
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(parsed.data.patientId)
  return { success: true, planId: plan.id, itemIds: insertedItems.map((row) => row.id) }
}

/**
 * "Kalemi Düzenle" — Kaydet action. `session_count` can never drop below
 * the item's completed session count (queried fresh here, never trusted
 * from the client). `revision_no` increments on every save. Optimistic
 * concurrency: the UPDATE's WHERE clause also pins `revision_no` to the
 * value this call read, so two concurrent saves on the same stale item
 * can't silently clobber each other — the second one gets a clear "az önce
 * başka biri güncelledi" error instead.
 */
export async function updateTreatmentPlanItem(
  values: ReviseTreatmentPlanItemValues,
): Promise<UpdateTreatmentPlanItemActionState> {
  const parsed = reviseTreatmentPlanItemSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canReviseTreatmentPlan(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from("treatment_plan_items")
    .select("id, patient_id, revision_no")
    .eq("id", parsed.data.itemId)
    .maybeSingle()

  if (existingError || !existing) return { error: "Tedavi kalemi bulunamadı." }

  const { count: completedCount, error: countError } = await supabase
    .from("treatment_sessions")
    .select("id", { count: "exact", head: true })
    .eq("treatment_plan_item_id", existing.id)
    .eq("status", "completed")

  if (countError) return { error: "Tamamlanan seans sayısı kontrol edilemedi." }

  const completedSessions = countError ? 0 : (completedCount ?? 0)
  if (parsed.data.sessionCount < completedSessions) {
    return {
      error: `Bu kalemde ${completedSessions} seans tamamlanmış — seans sayısı bunun altına düşürülemez.`,
      fieldErrors: { sessionCount: `En az ${completedSessions} olmalı.` },
    }
  }

  // Flat price — session count does not multiply it (founder decision 2026-09-13).
  const totalPrice = parsed.data.unitPrice ?? null
  const nextRevisionNo = existing.revision_no + 1

  const { data: updated, error: updateError } = await supabase
    .from("treatment_plan_items")
    .update({
      provider_id: parsed.data.providerId,
      treatment_name: parsed.data.treatmentName,
      session_count: parsed.data.sessionCount,
      unit_price: parsed.data.unitPrice ?? null,
      total_price: totalPrice,
      tooth_numbers: parsed.data.toothNumbers && parsed.data.toothNumbers.length > 0 ? parsed.data.toothNumbers : null,
      revision_no: nextRevisionNo,
      updated_by: staffMember.userId,
    })
    .eq("id", existing.id)
    .eq("revision_no", existing.revision_no)
    .select("id")
    .maybeSingle()

  if (updateError) return { error: "Tedavi kalemi güncellenemedi." }
  if (!updated) {
    return { error: "Bu kalem az önce başka biri tarafından güncellendi. Sayfayı yenileyip tekrar deneyin." }
  }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_plan_item_id: existing.id,
    // `plan_item_updated` has no matching enum value — reuses `series_updated`,
    // same mapping rationale as `createTreatmentPlan` above.
    activity_type: "series_updated",
    description: `Tedavi kalemi güncellendi (Değişiklik ${nextRevisionNo}): ${parsed.data.treatmentName}, ${parsed.data.sessionCount} seans.`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(existing.patient_id)
  return { success: true, revisionNo: nextRevisionNo }
}

/**
 * Client-callable wrapper around `getRemainingSessionsForPatient` — the
 * appointment form's "Mevcut Plandan Devam Et" option fetches this on
 * demand, same on-open/on-patient-change pattern as the legacy module's
 * `fetchActiveSeriesForPatient`.
 */
export async function getPatientActiveTreatmentPlansForAppointment(patientId: string): Promise<RemainingSessionItem[]> {
  if (!patientId) return []
  return getRemainingSessionsForPatient(patientId)
}

/**
 * Sprint 28C.1 — Flexible Delete & Audit: "Planı Sil". Never a hard DELETE —
 * sets deleted_at/deleted_by/delete_reason and cascades the same to every
 * still-active item under this plan. Appointments and treatment_sessions
 * are deliberately left untouched (founder decision): they stay exactly as
 * they are, only the plan (and its items) disappear from active screens.
 */
export async function deleteTreatmentPlan(values: DeleteTreatmentPlanValues): Promise<DeleteTreatmentActionState> {
  const parsed = deleteTreatmentPlanSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canDeleteTreatmentPlan(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, patient_id, plan_name")
    .eq("id", parsed.data.planId)
    .is("deleted_at", null)
    .maybeSingle()

  if (planError || !plan) return { error: "Tedavi planı bulunamadı." }

  const nowIso = new Date().toISOString()
  // Sprint 34 — reason is now optional; null when the user leaves it blank.
  const reason = parsed.data.reason?.trim() || null

  const { error: updateError } = await supabase
    .from("treatment_plans")
    .update({
      deleted_at: nowIso,
      deleted_by: staffMember.userId,
      delete_reason: reason,
      updated_by: staffMember.userId,
    })
    .eq("id", plan.id)

  if (updateError) return { error: "Tedavi planı silinemedi." }

  await supabase
    .from("treatment_plan_items")
    .update({
      deleted_at: nowIso,
      deleted_by: staffMember.userId,
      delete_reason: reason,
      updated_by: staffMember.userId,
    })
    .eq("treatment_plan_id", plan.id)
    .is("deleted_at", null)

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_plan_id: plan.id,
    activity_type: "plan_deleted",
    description: `Tedavi planı silindi: ${plan.plan_name}${reason ? ` — ${reason}` : ""}`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(plan.patient_id)
  return { success: true }
}

/**
 * "Kalemi Sil" — soft-deletes one item without touching its parent plan or
 * its already-completed treatment_sessions rows. Removing the item from the
 * "kalan seans" calculation is a side effect of the query layer's
 * `deleted_at is null` filter (`getRemainingSessionsForPatient`), not
 * anything this action computes itself.
 */
export async function deleteTreatmentPlanItem(values: DeleteTreatmentPlanItemValues): Promise<DeleteTreatmentActionState> {
  const parsed = deleteTreatmentPlanItemSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canDeleteTreatmentPlanItem(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  const { data: item, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select("id, patient_id, treatment_name")
    .eq("id", parsed.data.itemId)
    .is("deleted_at", null)
    .maybeSingle()

  if (itemError || !item) return { error: "Tedavi kalemi bulunamadı." }

  const { error: updateError } = await supabase
    .from("treatment_plan_items")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: staffMember.userId,
      delete_reason: parsed.data.reason,
      updated_by: staffMember.userId,
    })
    .eq("id", item.id)

  if (updateError) return { error: "Tedavi kalemi silinemedi." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_plan_item_id: item.id,
    activity_type: "plan_item_deleted",
    description: `Tedavi kalemi silindi: ${item.treatment_name} — ${parsed.data.reason}`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(item.patient_id)
  return { success: true }
}

/**
 * "Seansı Sil" — a separate facility from the corrected/voided state
 * machine (Sprint 28A), not a replacement for it: this hides a realized
 * visit from active screens without touching what it says happened.
 * `canDeleteTreatmentSession` is a direct alias of
 * `canCorrectOrVoidSession`, so (like correction/void) only a `completed`
 * session can be soft-deleted — one already `corrected`/`voided` is
 * terminal either way.
 */
export async function deleteTreatmentSession(values: DeleteTreatmentSessionValues): Promise<DeleteTreatmentActionState> {
  const parsed = deleteTreatmentSessionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from("treatment_sessions")
    .select("id, patient_id, performed_by, status, created_at")
    .eq("id", parsed.data.sessionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (sessionError || !session) return { error: "Seans bulunamadı." }

  const canDelete = canDeleteTreatmentSession(actorFrom(staffMember), {
    performedBy: session.performed_by,
    createdAt: session.created_at,
    status: session.status,
  })
  if (!canDelete) {
    return { error: "Bu işlem için yetkiniz yok — sadece kendi seanslarınızı veya (owner iseniz) her seansı silebilirsiniz." }
  }

  const { error: updateError } = await supabase
    .from("treatment_sessions")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: staffMember.userId,
      delete_reason: parsed.data.reason,
    })
    .eq("id", session.id)

  if (updateError) return { error: "Seans silinemedi." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_session_id: session.id,
    activity_type: "session_deleted",
    description: `Seans kaydı silindi — ${parsed.data.reason}`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(session.patient_id)
  return { success: true }
}

function revalidateAppointmentPath(appointmentId: string | null) {
  if (appointmentId) revalidatePath(`/appointments/${appointmentId}`)
}

/**
 * Sprint 28D — "Seansı Tamamla": the moment a `treatment_sessions` row is
 * actually created for the new model. `session_number` is always
 * server-derived (`completed, non-deleted count + 1`) — the schema doesn't
 * even accept one from the client. Idempotency: when `appointmentId` is
 * given, a second completion attempt against the same appointment+item is
 * rejected outright (the UI's own "already completed" check is not trusted
 * as the real guard). `unit_price_snapshot` freezes the item's current
 * `unit_price` so a later revision never re-prices this visit.
 */
export async function completeTreatmentSession(values: CompleteSessionFormValues): Promise<SessionActionState> {
  const parsed = completeSessionFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canCompleteSession(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  if (parsed.data.appointmentId) {
    const { data: existingForAppointment } = await supabase
      .from("treatment_sessions")
      .select("id")
      .eq("appointment_id", parsed.data.appointmentId)
      .eq("treatment_plan_item_id", parsed.data.treatmentPlanItemId)
      .eq("status", "completed")
      .is("deleted_at", null)
      .maybeSingle()
    if (existingForAppointment) {
      return { error: "Bu randevu için seans zaten tamamlanmış." }
    }
  }

  const { data: item, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select("id, patient_id, session_count, unit_price, status")
    .eq("id", parsed.data.treatmentPlanItemId)
    .is("deleted_at", null)
    .maybeSingle()

  if (itemError || !item) return { error: "Tedavi kalemi bulunamadı." }
  if (item.status !== "active") return { error: "Bu kalem artık aktif değil, seans tamamlanamaz." }

  const { count: completedCount, error: countError } = await supabase
    .from("treatment_sessions")
    .select("id", { count: "exact", head: true })
    .eq("treatment_plan_item_id", item.id)
    .eq("status", "completed")
    .is("deleted_at", null)

  if (countError) return { error: "Tamamlanan seans sayısı kontrol edilemedi." }

  const completed = completedCount ?? 0
  if (completed >= item.session_count) {
    return { error: "Bu kalemde tamamlanacak seans kalmadı." }
  }

  const nextSessionNumber = completed + 1

  const { data: session, error: insertError } = await supabase
    .from("treatment_sessions")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: item.patient_id,
      treatment_plan_item_id: item.id,
      appointment_id: parsed.data.appointmentId || null,
      session_number: nextSessionNumber,
      performed_by: parsed.data.performedBy,
      performed_at: parsed.data.performedAt,
      control_date: parsed.data.controlDate || null,
      notes: parsed.data.notes || null,
      unit_price_snapshot: item.unit_price,
      status: "completed",
      created_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (insertError || !session) return { error: "Seans kaydedilemedi." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_session_id: session.id,
    activity_type: "treatment_created",
    description: `${nextSessionNumber}. seans tamamlandı.`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(item.patient_id)
  revalidateAppointmentPath(parsed.data.appointmentId ?? null)
  return { success: true, sessionId: session.id, sessionNumber: nextSessionNumber }
}

/**
 * "Seansı Düzelt" — supersede-never-rewrite: the original row is marked
 * `corrected` (never updated again), a fresh `completed` row is inserted
 * with the same `session_number`, and `replaced_by_session_id` links the
 * two. The replacement is inserted first so the original's UPDATE can point
 * at a real id in the same statement it flips to `corrected`.
 */
export async function correctTreatmentSession(values: CorrectSessionFormValues): Promise<SessionActionState> {
  const parsed = correctSessionFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: original, error: originalError } = await supabase
    .from("treatment_sessions")
    .select("id, treatment_plan_item_id, patient_id, appointment_id, session_number, performed_by, status, created_at, unit_price_snapshot")
    .eq("id", parsed.data.sessionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (originalError || !original) return { error: "Seans bulunamadı." }

  const canCorrect = canCorrectOrVoidSession(actorFrom(staffMember), {
    performedBy: original.performed_by,
    createdAt: original.created_at,
    status: original.status,
  })
  if (!canCorrect) {
    return { error: "Bu işlem için yetkiniz yok — sadece kendi seanslarınızı veya (owner iseniz) her seansı düzeltebilirsiniz." }
  }

  const { data: replacement, error: insertError } = await supabase
    .from("treatment_sessions")
    .insert({
      clinic_id: staffMember.clinicId,
      patient_id: original.patient_id,
      treatment_plan_item_id: original.treatment_plan_item_id,
      appointment_id: original.appointment_id,
      session_number: original.session_number,
      performed_by: parsed.data.performedBy,
      performed_at: parsed.data.performedAt,
      control_date: parsed.data.controlDate || null,
      notes: parsed.data.notes || null,
      unit_price_snapshot: original.unit_price_snapshot,
      status: "completed",
      created_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (insertError || !replacement) return { error: "Düzeltme kaydedilemedi." }

  const { error: updateError } = await supabase
    .from("treatment_sessions")
    .update({
      status: "corrected",
      corrected_by: staffMember.userId,
      corrected_at: new Date().toISOString(),
      correction_reason: parsed.data.reason,
      replaced_by_session_id: replacement.id,
    })
    .eq("id", original.id)

  if (updateError) return { error: "Seans düzeltilemedi." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_session_id: replacement.id,
    activity_type: "treatment_updated",
    description: `${original.session_number}. seans düzeltildi — ${parsed.data.reason}`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(original.patient_id)
  revalidateAppointmentPath(original.appointment_id)
  return { success: true, sessionId: replacement.id, sessionNumber: original.session_number }
}

/** "Seansı İptal Et" — marks the row `voided` in place, no replacement row (this visit never should have counted). Same actor authority as correction. */
export async function voidTreatmentSession(values: VoidSessionFormValues): Promise<DeleteTreatmentActionState> {
  const parsed = voidSessionFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from("treatment_sessions")
    .select("id, patient_id, appointment_id, performed_by, status, created_at, session_number")
    .eq("id", parsed.data.sessionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (sessionError || !session) return { error: "Seans bulunamadı." }

  const canVoid = canCorrectOrVoidSession(actorFrom(staffMember), {
    performedBy: session.performed_by,
    createdAt: session.created_at,
    status: session.status,
  })
  if (!canVoid) {
    return { error: "Bu işlem için yetkiniz yok — sadece kendi seanslarınızı veya (owner iseniz) her seansı geçersiz kılabilirsiniz." }
  }

  const { error: updateError } = await supabase
    .from("treatment_sessions")
    .update({
      status: "voided",
      corrected_by: staffMember.userId,
      corrected_at: new Date().toISOString(),
      correction_reason: parsed.data.reason,
    })
    .eq("id", session.id)

  if (updateError) return { error: "Seans geçersiz kılınamadı." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_session_id: session.id,
    activity_type: "status_changed",
    description: `${session.session_number}. seans geçersiz kılındı — ${parsed.data.reason}`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(session.patient_id)
  revalidateAppointmentPath(session.appointment_id)
  return { success: true }
}

/**
 * "Ödeme Ekle" — always `entry_type: "payment"`; a correction/refund goes
 * through `recordTreatmentPlanPaymentCorrection` instead, never this
 * action. Append-only: no UPDATE/DELETE grant exists on `treatment_payments`
 * at all, so a wrong entry can only ever be corrected by a new row.
 */
export async function recordTreatmentPlanPayment(
  values: TreatmentPlanPaymentFormValues,
): Promise<RecordTreatmentPlanPaymentActionState> {
  const parsed = treatmentPlanPaymentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canRecordPayment(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, patient_id")
    .eq("id", parsed.data.treatmentPlanId)
    .is("deleted_at", null)
    .maybeSingle()

  if (planError || !plan) return { error: "Tedavi planı bulunamadı." }

  const { data: payment, error: insertError } = await supabase
    .from("treatment_payments")
    .insert({
      clinic_id: staffMember.clinicId,
      treatment_plan_id: plan.id,
      amount: parsed.data.amount,
      entry_type: "payment",
      method: parsed.data.method,
      currency: parsed.data.currency,
      paid_at: parsed.data.paidAt,
      note: parsed.data.note || null,
      recorded_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (insertError || !payment) return { error: "Ödeme kaydedilemedi." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_plan_id: plan.id,
    activity_type: "payment_recorded",
    description: `Ödeme kaydedildi: ${parsed.data.amount.toLocaleString("tr-TR")} ₺`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(plan.patient_id)
  return { success: true, paymentId: payment.id }
}

/**
 * "İade / Düzeltme" — always references the payment it corrects via
 * `relatedPaymentId`; the original row is never touched. Unlike the legacy
 * `recordPaymentCorrection`, this new action adds an explicit
 * `canCorrectPayment` check of its own (the legacy one relies purely on
 * RLS, which — same gap on both models — doesn't actually distinguish a
 * `refund`/`adjustment` insert from a plain `payment` one). Closing that gap
 * here is scoped to this new action only; the legacy action is untouched.
 */
export async function recordTreatmentPlanPaymentCorrection(
  values: TreatmentPlanPaymentCorrectionValues,
): Promise<RecordTreatmentPlanPaymentActionState> {
  const parsed = treatmentPlanPaymentCorrectionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canCorrectPayment(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, patient_id")
    .eq("id", parsed.data.treatmentPlanId)
    .is("deleted_at", null)
    .maybeSingle()

  if (planError || !plan) return { error: "Tedavi planı bulunamadı." }

  // A correction (refund/adjustment) is always in the same currency as the
  // payment it references — never re-picked by the user, so it can't drift
  // from the original and skew a per-currency balance.
  const { data: relatedPayment } = await supabase
    .from("treatment_payments")
    .select("currency")
    .eq("id", parsed.data.relatedPaymentId)
    .maybeSingle()

  const { data: correction, error: insertError } = await supabase
    .from("treatment_payments")
    .insert({
      clinic_id: staffMember.clinicId,
      treatment_plan_id: plan.id,
      related_payment_id: parsed.data.relatedPaymentId,
      amount: parsed.data.amount,
      entry_type: parsed.data.entryType,
      method: parsed.data.method,
      currency: relatedPayment?.currency ?? "TRY",
      paid_at: parsed.data.paidAt,
      note: parsed.data.note || null,
      recorded_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (insertError || !correction) return { error: "Düzeltme kaydedilemedi." }

  const activity: TreatmentActivityInsert = {
    clinic_id: staffMember.clinicId,
    treatment_plan_id: plan.id,
    activity_type: "payment_recorded",
    description: `Ödeme düzeltmesi kaydedildi (${TREATMENT_PAYMENT_ENTRY_TYPE_LABELS[parsed.data.entryType]}): ${parsed.data.amount.toLocaleString("tr-TR")} ₺`,
    created_by: staffMember.userId,
  }
  await supabase.from("treatment_activities").insert(activity)

  revalidatePatientPaths(plan.patient_id)
  return { success: true, paymentId: correction.id }
}

/**
 * Hard-delete a single payment ledger row — the Dashboard "Bu Ay Toplam Ciro"
 * drill-down's "Sil" action (founder decision 2026-09-13). Deliberately a
 * physical delete, not a correction entry or a soft delete: the founder chose
 * this over the audit-preserving alternatives after being shown the tradeoff
 * (see `20260913090000_allow_treatment_payment_delete.sql`). Owner/secretary
 * only — the same gate as a correction, enforced here AND by the new DELETE
 * RLS policy (RLS stays the real boundary). Works for both legacy
 * series-attached and new plan-attached rows, since they share one table.
 */
export async function deleteTreatmentPayment(paymentId: string): Promise<DeleteTreatmentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  if (!canCorrectPayment(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()

  // Resolve the affected patient before deleting — the row is gone afterward,
  // and both the patient card and the Dashboard need to reflect the removal.
  const { data: payment } = await supabase
    .from("treatment_payments")
    .select("treatment_plan_id, series_id")
    .eq("id", paymentId)
    .maybeSingle()

  const { data: deleted, error } = await supabase
    .from("treatment_payments")
    .delete()
    .eq("id", paymentId)
    .select("id")

  if (error) return { error: "Ödeme silinemedi." }
  // RLS (clinic + owner/secretary) can silently match zero rows rather than
  // error — treat that as "not found or not allowed" instead of a false success.
  if (!deleted || deleted.length === 0) return { error: "Ödeme bulunamadı veya silme yetkiniz yok." }

  let patientId: string | null = null
  if (payment?.treatment_plan_id) {
    const { data: plan } = await supabase
      .from("treatment_plans")
      .select("patient_id")
      .eq("id", payment.treatment_plan_id)
      .maybeSingle()
    patientId = plan?.patient_id ?? null
  } else if (payment?.series_id) {
    const { data: seriesRow } = await supabase
      .from("treatment_series")
      .select("patient_id")
      .eq("id", payment.series_id)
      .maybeSingle()
    patientId = seriesRow?.patient_id ?? null
  }

  if (patientId) revalidatePatientPaths(patientId)
  revalidatePath("/dashboard")
  return { success: true }
}

/**
 * Permanently (hard) delete a whole treatment plan and everything under it —
 * items, sessions (including completed ones), payments, and activities — from
 * the Dashboard "Bekleyen Bakiye" drill-down (founder decision 2026-09-13).
 * Deliberately NOT the soft `deleteTreatmentPlan` (which keeps the row behind
 * `deleted_at`): the founder chose an irreversible wipe over the recoverable
 * one after being shown that this also destroys completed clinical sessions.
 *
 * The FKs across the module are all `on delete no action`, so children must be
 * removed in dependency order; there is no `on delete cascade` to lean on, and
 * cascading would wrongly take appointments with it. Appointments are instead
 * DETACHED (their plan/item refs nulled) so the schedule survives the wipe.
 *
 * Runs through the service-role client on purpose: none of these clinical
 * tables grant DELETE to `authenticated` (they are soft-delete-only by
 * design), and adding permanent DELETE RLS policies to all of them would
 * broaden the destructive surface far more than confining this one wipe to a
 * single owner/secretary-gated, clinic-scoped server action does. Ownership +
 * clinic are verified with the RLS-scoped client first; the admin client only
 * performs the already-authorized deletes.
 */
export async function deleteTreatmentPlanPermanently(planId: string): Promise<DeleteTreatmentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (!canCorrectPayment(actorFrom(staffMember))) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  // Ownership + clinic scope check via the RLS-scoped client — the admin
  // client below bypasses RLS, so this is the real authorization gate.
  const supabase = await createClient()
  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, patient_id, clinic_id")
    .eq("id", planId)
    .maybeSingle()
  if (planError || !plan) return { error: "Tedavi planı bulunamadı." }
  if (plan.clinic_id !== staffMember.clinicId) return { error: "Bu işlem için yetkiniz yok." }

  const admin = createAdminClient()

  const { data: itemRows } = await admin.from("treatment_plan_items").select("id").eq("treatment_plan_id", planId)
  const itemIds = (itemRows ?? []).map((row) => row.id)

  let sessionIds: string[] = []
  if (itemIds.length > 0) {
    const { data: sessionRows } = await admin
      .from("treatment_sessions")
      .select("id")
      .in("treatment_plan_item_id", itemIds)
    sessionIds = (sessionRows ?? []).map((row) => row.id)
  }

  // 1. Activities pointing at the plan, any of its items, or any of its sessions.
  const activityOr = [`treatment_plan_id.eq.${planId}`]
  if (itemIds.length > 0) activityOr.push(`treatment_plan_item_id.in.(${itemIds.join(",")})`)
  if (sessionIds.length > 0) activityOr.push(`treatment_session_id.in.(${sessionIds.join(",")})`)
  const { error: activityErr } = await admin.from("treatment_activities").delete().or(activityOr.join(","))
  if (activityErr) return { error: "Plan silinemedi (aktiviteler)." }

  // 2. Detach appointments — keep the schedule, drop the link to the wiped plan.
  const { error: apptPlanErr } = await admin
    .from("appointments")
    .update({ treatment_plan_id: null, treatment_plan_item_id: null })
    .eq("treatment_plan_id", planId)
  if (apptPlanErr) return { error: "Plan silinemedi (randevular)." }
  if (itemIds.length > 0) {
    await admin.from("appointments").update({ treatment_plan_item_id: null }).in("treatment_plan_item_id", itemIds)
  }

  // 3. Sessions — clear the self-referential replaced_by pointer first so the
  //    batch delete can't trip its own FK, then delete.
  if (sessionIds.length > 0) {
    await admin.from("treatment_sessions").update({ replaced_by_session_id: null }).in("id", sessionIds)
    const { error: sessionErr } = await admin.from("treatment_sessions").delete().in("id", sessionIds)
    if (sessionErr) return { error: "Plan silinemedi (seanslar)." }
  }

  // 4. Payments — clear related_payment_id (correction → payment self-ref) first.
  await admin.from("treatment_payments").update({ related_payment_id: null }).eq("treatment_plan_id", planId)
  const { error: paymentErr } = await admin.from("treatment_payments").delete().eq("treatment_plan_id", planId)
  if (paymentErr) return { error: "Plan silinemedi (ödemeler)." }

  // 5. Items, then 6. the plan itself.
  if (itemIds.length > 0) {
    const { error: itemErr } = await admin.from("treatment_plan_items").delete().eq("treatment_plan_id", planId)
    if (itemErr) return { error: "Plan silinemedi (kalemler)." }
  }
  const { error: deletePlanErr } = await admin.from("treatment_plans").delete().eq("id", planId)
  if (deletePlanErr) return { error: "Plan silinemedi." }

  revalidatePatientPaths(plan.patient_id)
  revalidatePath("/dashboard")
  return { success: true }
}

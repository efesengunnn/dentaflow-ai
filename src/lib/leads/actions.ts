"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { LEAD_ACTIVITY_LABELS, LEAD_STATUS_LABELS } from "@/lib/leads/constants"
import { parseLeadsWorkbook, type LeadImportRow, type LeadImportRowError } from "@/lib/leads/import"
import { leadFormSchema, type LeadFormValues } from "@/lib/leads/schema"
import { getAssignableStaff } from "@/lib/staff/queries"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

type LeadActivityInsert = Database["public"]["Tables"]["lead_activities"]["Insert"]

export type LeadActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

export async function createLead(values: LeadFormValues): Promise<LeadActionState> {
  const parsed = leadFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      clinic_id: staffMember.clinicId,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      source: parsed.data.source,
      status: parsed.data.status,
      assigned_to: parsed.data.assignedTo || null,
      created_by: staffMember.userId,
      updated_by: staffMember.userId,
    })
    .select("id")
    .single()

  if (error || !lead) {
    return { error: "Potansiyel müşteri oluşturulamadı. Bilgileri kontrol edip tekrar deneyin." }
  }

  const activities: LeadActivityInsert[] = [
    {
      clinic_id: staffMember.clinicId,
      lead_id: lead.id,
      activity_type: "lead_created",
      description: LEAD_ACTIVITY_LABELS.lead_created,
      created_by: staffMember.userId,
    },
  ]
  if (parsed.data.note?.trim()) {
    activities.push({
      clinic_id: staffMember.clinicId,
      lead_id: lead.id,
      activity_type: "note_added" as const,
      description: parsed.data.note.trim(),
      created_by: staffMember.userId,
    })
  }
  await supabase.from("lead_activities").insert(activities)

  revalidatePath("/leads")
  redirect(`/leads/${lead.id}`)
}

export async function updateLead(
  leadId: string,
  values: LeadFormValues,
): Promise<LeadActionState> {
  const parsed = leadFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("leads")
    .select("full_name, phone, email, source, status, assigned_to")
    .eq("id", leadId)
    .single()

  if (!existing) return { error: "Potansiyel müşteri bulunamadı." }

  const { error } = await supabase
    .from("leads")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      source: parsed.data.source,
      status: parsed.data.status,
      assigned_to: parsed.data.assignedTo || null,
      updated_by: staffMember.userId,
    })
    .eq("id", leadId)

  if (error) return { error: "Potansiyel müşteri güncellenemedi." }

  const activities: LeadActivityInsert[] = []

  if (existing.status !== parsed.data.status) {
    activities.push({
      clinic_id: staffMember.clinicId,
      lead_id: leadId,
      activity_type: "status_changed",
      description: `Durum "${LEAD_STATUS_LABELS[existing.status]}" durumundan "${LEAD_STATUS_LABELS[parsed.data.status]}" durumuna değiştirildi.`,
      metadata: { from_status: existing.status, to_status: parsed.data.status },
      created_by: staffMember.userId,
    })
  }

  const otherFieldsChanged =
    existing.full_name !== parsed.data.fullName ||
    existing.phone !== parsed.data.phone ||
    (existing.email ?? "") !== (parsed.data.email ?? "") ||
    existing.source !== parsed.data.source ||
    (existing.assigned_to ?? "") !== (parsed.data.assignedTo ?? "")

  if (otherFieldsChanged) {
    activities.push({
      clinic_id: staffMember.clinicId,
      lead_id: leadId,
      activity_type: "lead_updated",
      description: LEAD_ACTIVITY_LABELS.lead_updated,
      created_by: staffMember.userId,
    })
  }

  if (parsed.data.note?.trim()) {
    activities.push({
      clinic_id: staffMember.clinicId,
      lead_id: leadId,
      activity_type: "note_added",
      description: parsed.data.note.trim(),
      created_by: staffMember.userId,
    })
  }

  if (activities.length) {
    await supabase.from("lead_activities").insert(activities)
  }

  revalidatePath("/leads")
  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function addLeadNote(leadId: string, note: string): Promise<LeadActionState> {
  const trimmed = note.trim()
  if (!trimmed) return { error: "Not boş olamaz." }
  if (trimmed.length > 2000) return { error: "Not 2000 karakteri geçemez." }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("lead_activities").insert({
    clinic_id: staffMember.clinicId,
    lead_id: leadId,
    activity_type: "note_added",
    description: trimmed,
    created_by: staffMember.userId,
  })

  if (error) return { error: "Not eklenemedi." }

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function softDeleteLead(leadId: string): Promise<LeadActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString(), updated_by: staffMember.userId })
    .eq("id", leadId)

  if (error) return { error: "Potansiyel müşteri silinemedi." }

  await supabase.from("lead_activities").insert({
    clinic_id: staffMember.clinicId,
    lead_id: leadId,
    activity_type: "lead_deleted",
    description: LEAD_ACTIVITY_LABELS.lead_deleted,
    created_by: staffMember.userId,
  })

  revalidatePath("/leads")
  redirect("/leads")
}

export type LeadImportPreviewRow = LeadImportRow & { assignedToId: string | null }

export type LeadImportPreviewResult =
  | { error: string }
  | { validRows: LeadImportPreviewRow[]; errors: LeadImportRowError[]; totalRows: number }

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 500

/**
 * Reads and validates an uploaded .xlsx, resolving "Sorumlu Personel" names to
 * staff IDs, but does NOT write anything — `commitLeadImport` is the
 * explicit second step once the founder/staff member has reviewed this
 * preview in the UI. Never bulk-write unvalidated user-uploaded data
 * directly.
 */
export async function previewLeadImport(formData: FormData): Promise<LeadImportPreviewResult> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role === "doctor") return { error: "Bu işlem için yetkiniz yok." }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { error: "Bir dosya seçin." }
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { error: "Dosya boyutu 5MB'ı geçemez." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { validRows, errors, totalRows } = await parseLeadsWorkbook(buffer)

  if (validRows.length > MAX_IMPORT_ROWS) {
    return { error: `Tek seferde en fazla ${MAX_IMPORT_ROWS} kayıt içe aktarılabilir.` }
  }

  const staffOptions = await getAssignableStaff()
  const staffIdByName = new Map(
    staffOptions.map((staff) => [staff.fullName.trim().toLocaleLowerCase("tr"), staff.id]),
  )

  const resolvedRows: LeadImportPreviewRow[] = validRows.map((row) => ({
    ...row,
    assignedToId: row.assignedToName
      ? (staffIdByName.get(row.assignedToName.trim().toLocaleLowerCase("tr")) ?? null)
      : null,
  }))

  return { validRows: resolvedRows, errors, totalRows }
}

/** Second, explicit step: actually inserts the rows the founder/staff member confirmed in the preview. */
export async function commitLeadImport(
  rows: LeadImportPreviewRow[],
): Promise<{ error?: string; imported?: number }> {
  if (rows.length === 0) return { error: "İçe aktarılacak kayıt yok." }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Tek seferde en fazla ${MAX_IMPORT_ROWS} kayıt içe aktarılabilir.` }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role === "doctor") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()

  const { data: insertedLeads, error } = await supabase
    .from("leads")
    .insert(
      rows.map((row) => ({
        clinic_id: staffMember.clinicId,
        full_name: row.fullName,
        phone: row.phone,
        email: row.email,
        source: row.source,
        status: row.status,
        assigned_to: row.assignedToId,
        created_by: staffMember.userId,
        updated_by: staffMember.userId,
      })),
    )
    .select("id")

  if (error || !insertedLeads) {
    return { error: "İçe aktarma başarısız oldu. Lütfen tekrar deneyin." }
  }

  const activities: LeadActivityInsert[] = insertedLeads.map((lead) => ({
    clinic_id: staffMember.clinicId,
    lead_id: lead.id,
    activity_type: "lead_created",
    description: "Excel içe aktarma ile oluşturuldu.",
    created_by: staffMember.userId,
  }))
  await supabase.from("lead_activities").insert(activities)

  revalidatePath("/leads")
  return { imported: insertedLeads.length }
}

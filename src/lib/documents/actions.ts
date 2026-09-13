"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { createClient } from "@/lib/supabase/server"
import { PATIENT_DOCUMENTS_BUCKET } from "@/lib/documents/constants"

export type DocumentActionState = { error?: string; success?: boolean }

/**
 * The file bytes are uploaded straight from the browser to Storage (a Vercel
 * Function's 4.5MB body cap can't carry an X-ray); this only records the
 * metadata row afterward. `clinic_id`/`uploaded_by` come from the session,
 * never the client. RLS re-checks clinic + role.
 */
export async function recordPatientDocument(input: {
  patientId: string
  storagePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<DocumentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { error } = await supabase.from("patient_documents").insert({
    clinic_id: staffMember.clinicId,
    patient_id: input.patientId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    uploaded_by: staffMember.userId,
  })

  if (error) {
    // The object was already uploaded; drop it so a failed insert doesn't
    // leave an orphaned file behind.
    await supabase.storage.from(PATIENT_DOCUMENTS_BUCKET).remove([input.storagePath])
    return { error: "Belge kaydedilemedi." }
  }

  revalidatePath(`/patients/${input.patientId}`)
  return { success: true }
}

/** Soft-delete the metadata row and remove the object from Storage. */
export async function deletePatientDocument(input: {
  documentId: string
  patientId: string
  storagePath: string
}): Promise<DocumentActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("patient_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.documentId)
    .select("id")

  if (error) return { error: "Belge silinemedi." }
  if (!updated || updated.length === 0) return { error: "Belge bulunamadı veya yetkiniz yok." }

  await supabase.storage.from(PATIENT_DOCUMENTS_BUCKET).remove([input.storagePath])

  revalidatePath(`/patients/${input.patientId}`)
  return { success: true }
}

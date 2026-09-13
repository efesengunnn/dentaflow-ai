import { PATIENT_DOCUMENTS_BUCKET } from "@/lib/documents/constants"
import { createClient } from "@/lib/supabase/server"

export type PatientDocument = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  uploadedByName: string | null
  storagePath: string
  /** Short-lived signed URL for inline viewing; `null` if the object couldn't be signed. */
  url: string | null
}

// One hour — long enough to browse/view during a page session without
// re-fetching, short enough that a leaked URL expires quickly (private bucket).
const SIGNED_URL_TTL_SECONDS = 60 * 60

/**
 * A patient's documents (röntgen etc.) with a freshly-signed view URL per row.
 * The bucket is private, so nothing is viewable without a signed URL; signing
 * happens server-side here so the client can render images/PDFs inline with no
 * extra round trip. RLS scopes both the table read and the signing to the
 * caller's own clinic.
 */
export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("patient_documents")
    .select(
      "id, file_name, mime_type, size_bytes, created_at, storage_path, uploader:staff_members!patient_documents_uploaded_by_fkey(full_name)",
    )
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: signed } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_TTL_SECONDS,
    )
  const urlByPath = new Map((signed ?? []).map((entry) => [entry.path ?? "", entry.signedUrl]))

  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    uploadedByName: row.uploader?.full_name ?? null,
    storagePath: row.storage_path,
    url: urlByPath.get(row.storage_path) ?? null,
  }))
}

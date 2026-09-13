/** Shared document constants — safe to import from both server and client (no server-only deps here). */

export const PATIENT_DOCUMENTS_BUCKET = "patient-documents"

/** 20 MB — matches the bucket's `file_size_limit` (see the create migration). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

/** Matches the bucket's `allowed_mime_types`: dental X-rays/photos + PDF. */
export const ALLOWED_DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const

/** For the file input's `accept` attribute. */
export const ALLOWED_DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(",")

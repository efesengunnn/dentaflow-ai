"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { PlaceholderCard } from "@/components/shared/placeholder-card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ALLOWED_DOCUMENT_ACCEPT,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  PATIENT_DOCUMENTS_BUCKET,
} from "@/lib/documents/constants"
import { deletePatientDocument, recordPatientDocument } from "@/lib/documents/actions"
import type { PatientDocument } from "@/lib/documents/queries"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/")
}

/** Storage keys stay ASCII-safe; the original (possibly Turkish) name is kept in the DB. */
function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_")
}

/**
 * Sprint 33 — Patient "Belgeler" tab. Uploads go straight from the browser to
 * the private Storage bucket (bypassing the Function body-size cap), then a
 * metadata row is recorded. Files are viewed inline via short-lived signed
 * URLs (images in an <img>, PDFs in an <iframe>) — no download required.
 */
function PatientDocumentsSection({
  patientId,
  clinicId,
  documents,
}: {
  patientId: string
  clinicId: string
  documents: PatientDocument[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<PatientDocument | null>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setUploading(true)
    const supabase = createClient()
    let uploaded = 0

    for (const file of files) {
      if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: desteklenmeyen dosya türü (JPG, PNG, WebP veya PDF olmalı).`)
        continue
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        toast.error(`${file.name}: dosya çok büyük (en fazla 20 MB).`)
        continue
      }

      const path = `${clinicId}/${patientId}/${crypto.randomUUID()}-${sanitizeName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from(PATIENT_DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        toast.error(`${file.name}: yüklenemedi.`)
        continue
      }

      const result = await recordPatientDocument({
        patientId,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      if (result?.error) {
        toast.error(`${file.name}: ${result.error}`)
        continue
      }
      uploaded += 1
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? "Belge yüklendi." : `${uploaded} belge yüklendi.`)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Belgeler</h3>
          <p className="text-muted-foreground text-sm">Röntgen ve diğer belgeleri yükleyin, indirmeden görüntüleyin.</p>
        </div>
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploading ? "Yükleniyor..." : "Belge Yükle"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_DOCUMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {documents.length === 0 ? (
        <PlaceholderCard
          icon={FileText}
          text="Henüz belge yok. Röntgen ve diğer belgeleri yükleyerek burada saklayabilir, indirmeden görüntüleyebilirsiniz."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group border-border bg-card relative flex flex-col overflow-hidden rounded-xl border"
            >
              <button
                type="button"
                onClick={() => setViewing(doc)}
                className="hover:bg-muted/40 flex aspect-square w-full items-center justify-center overflow-hidden transition-colors"
                aria-label={`${doc.fileName} önizle`}
              >
                {isImage(doc.mimeType) && doc.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.url} alt={doc.fileName} className="size-full object-cover" />
                ) : (
                  <FileText className="text-muted-foreground size-10" />
                )}
              </button>
              <div className="flex items-start justify-between gap-1.5 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium" title={doc.fileName}>
                    {doc.fileName}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {formatBytes(doc.sizeBytes)} · {format(new Date(doc.createdAt), "d MMM", { locale: tr })}
                  </p>
                </div>
                <div onClick={(event) => event.stopPropagation()}>
                  <EntityDeleteDialog
                    title="Belge silinsin mi?"
                    description={`"${doc.fileName}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
                    triggerLabel=""
                    triggerIcon={Trash2}
                    triggerVariant="ghost"
                    triggerSize="icon-sm"
                    confirmVariant="destructive"
                    triggerClassName="text-muted-foreground hover:text-destructive shrink-0"
                    onConfirm={async () => {
                      const result = await deletePatientDocument({
                        documentId: doc.id,
                        patientId,
                        storagePath: doc.storagePath,
                      })
                      if (result?.success) router.refresh()
                      return result?.error ? { error: result.error } : undefined
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{viewing?.fileName}</DialogTitle>
          </DialogHeader>
          <div className={cn("px-4 pb-4")}>
            {viewing?.url ? (
              isImage(viewing.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewing.url}
                  alt={viewing.fileName}
                  className="mx-auto max-h-[75vh] w-auto rounded-lg object-contain"
                />
              ) : (
                <iframe src={viewing.url} title={viewing.fileName} className="h-[75vh] w-full rounded-lg border-0" />
              )
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">Belge görüntülenemiyor.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { PatientDocumentsSection }

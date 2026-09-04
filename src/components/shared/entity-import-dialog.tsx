"use client"

import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type ImportRowError = { rowNumber: number; message: string }

type ImportPreviewResult<TRow> =
  | { error: string }
  | { validRows: TRow[]; errors: ImportRowError[]; totalRows: number }

type EntityImportDialogProps<
  TRow extends { rowNumber: number },
  TCommitResult extends { error?: string; imported?: number },
> = {
  templateHref: string
  previewAction: (formData: FormData) => Promise<ImportPreviewResult<TRow>>
  commitAction: (rows: TRow[]) => Promise<TCommitResult>
  /** Preview table's first column — a row's primary identifier (a name, a phone, ...). */
  renderPreviewPrimary: (row: TRow) => ReactNode
  /** Second preview-table column — the one bit of preview content that's genuinely entity-specific. */
  renderPreviewDetail: (row: TRow) => ReactNode
  /**
   * Defaults to "N kayıt içe aktarıldı." — override when the commit result
   * carries more than a plain success count (e.g. Appointments' per-row
   * partial-failure reporting: some rows can fail an overlap/lookup check
   * without aborting the rest of the file).
   */
  successMessage?: (result: TCommitResult) => string
}

/**
 * Generic Excel import dialog: upload -> server-side preview (no writes) ->
 * explicit confirm -> commit. Lifted out of `LeadImportDialog` (Sprint 3.6)
 * when Patients (Sprint 4) needed the identical dialog chrome; generalized
 * again for Appointments (Sprint 6), whose preview rows have no `fullName`
 * and whose commit can partially fail per-row — only the Server Actions,
 * template link, and the two preview-table renderers/success message differ
 * per module now.
 */
function EntityImportDialog<
  TRow extends { rowNumber: number },
  TCommitResult extends { error?: string; imported?: number },
>({
  templateHref,
  previewAction,
  commitAction,
  renderPreviewPrimary,
  renderPreviewDetail,
  successMessage,
}: EntityImportDialogProps<TRow, TCommitResult>) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<Extract<ImportPreviewResult<TRow>, { validRows: unknown }> | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setPreview(null)

    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      const result = await previewAction(formData)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setPreview(result)
    })
  }

  function handleConfirm() {
    if (!preview) return
    startTransition(async () => {
      const result = await commitAction(preview.validRows)
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success(
        successMessage ? successMessage(result) : `${result.imported} kayıt içe aktarıldı.`,
      )
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload />
          İçe Aktar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Excel&apos;den İçe Aktar</DialogTitle>
          <DialogDescription>
            Şablonu indirip doldurun, ardından buradan yükleyin. Kaydetmeden önce bir önizleme
            gösterilir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Plain <a>, not next/link — this is a file download
              (Content-Disposition: attachment), not a page route. */}
          <a
            href={templateHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
          >
            <Download className="size-4" />
            Şablonu indir
          </a>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          {preview && (
            <div className="flex flex-col gap-3">
              <Alert variant={preview.errors.length ? "destructive" : "default"}>
                <FileSpreadsheet />
                <AlertTitle>
                  {preview.validRows.length} kayıt hazır
                  {preview.errors.length > 0 ? `, ${preview.errors.length} kayıt hatalı` : ""}
                </AlertTitle>
                {preview.errors.length > 0 && (
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {preview.errors.slice(0, 8).map((rowError, index) => (
                        <li key={index}>
                          Satır {rowError.rowNumber}: {rowError.message}
                        </li>
                      ))}
                      {preview.errors.length > 8 && (
                        <li>...ve {preview.errors.length - 8} hata daha</li>
                      )}
                    </ul>
                  </AlertDescription>
                )}
              </Alert>

              {preview.validRows.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.validRows.slice(0, 20).map((row) => (
                        <tr key={row.rowNumber} className="border-b last:border-0">
                          <td className="p-2">{renderPreviewPrimary(row)}</td>
                          <td className="p-2 text-muted-foreground">{renderPreviewDetail(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!preview || preview.validRows.length === 0}
            loading={isPending}
          >
            {preview ? `${preview.validRows.length} Kaydı İçe Aktar` : "İçe Aktar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { EntityImportDialog }

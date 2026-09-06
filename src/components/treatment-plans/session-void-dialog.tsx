"use client"

import { Ban } from "lucide-react"
import { useRouter } from "next/navigation"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { voidTreatmentSession } from "@/lib/treatment-plans/actions"
import type { TreatmentSessionRow } from "@/lib/treatment-plans/queries"

/** "Seansı İptal Et" — marks the row `voided` in place, no replacement row (this visit never should have counted). Reuses the shared `EntityDeleteDialog` shape (reason-required confirm), not a bespoke dialog. */
function SessionVoidDialog({ session, onSuccess }: { session: TreatmentSessionRow; onSuccess?: () => void }) {
  const router = useRouter()

  return (
    <EntityDeleteDialog
      title={`${session.sessionNumber}. seans iptal edilsin mi?`}
      description="Bu seans hiç gerçekleşmemiş olarak işaretlenir (yanlış hasta, mükerrer kayıt vb.) — kalan seans sayısına geri eklenir. Kayıt kalıcı olarak silinmez."
      triggerLabel=""
      triggerIcon={Ban}
      triggerVariant="ghost"
      triggerSize="icon-xs"
      triggerClassName="text-destructive hover:text-destructive"
      confirmVariant="destructive"
      confirmLabel="İptal Et"
      confirmingLabel="İptal ediliyor..."
      requireReason
      reasonLabel="İptal sebebi"
      reasonPlaceholder="Bu seans neden iptal ediliyor?"
      onConfirm={async (reason) => {
        const result = await voidTreatmentSession({ sessionId: session.id, reason })
        if (result?.success) {
          router.refresh()
          onSuccess?.()
          return undefined
        }
        return { error: result?.error ?? "Seans iptal edilemedi." }
      }}
    />
  )
}

export { SessionVoidDialog }

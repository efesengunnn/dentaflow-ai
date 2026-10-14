"use client"

import { Check, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format/currency"
import { sortTeeth } from "@/lib/odontogram/fdi"
import { deleteTreatmentPlanItem } from "@/lib/treatment-plans/actions"
import { deriveItemProgress } from "@/lib/treatment-plans/constants"
import { canDeleteTreatmentPlanItem, type TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanItemDetail } from "@/lib/treatment-plans/queries"
import { cn } from "@/lib/utils"
import { CompleteTreatmentControl, type CompletableTreatmentItem } from "./complete-treatment-control"
import { TreatmentProgressBadge, TreatmentProgressBar } from "./treatment-progress-badge"

type TreatmentRowItem = CompletableTreatmentItem & {
  providerName: string
  totalPrice: number | null
  currency: string
}

/** Charted teeth as small chips — completed ones turn green with a check, so partial progress reads at a glance. */
function ToothChips({ toothNumbers, completedToothNumbers }: { toothNumbers: number[]; completedToothNumbers: number[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {sortTeeth(toothNumbers).map((tooth) => {
        const done = completedToothNumbers.includes(tooth)
        return (
          <span
            key={tooth}
            className={cn(
              "inline-flex h-6 items-center gap-0.5 rounded-md border px-1.5 text-xs font-medium tabular-nums",
              done ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted/40 text-foreground",
            )}
          >
            {done && <Check className="size-3" />}
            {tooth}
          </span>
        )
      })}
    </div>
  )
}

/**
 * One treatment line (2026-10-14): name · teeth · price · "Tamamlandı", with
 * the yellow / blue / green progress bar on its left edge. Session counters
 * are gone from this surface entirely. Used by the patient card's inline plan
 * detail and the appointment detail; `actions` carries surface-specific extras
 * (e.g. edit/delete on the plan detail).
 */
function TreatmentItemRow({
  item,
  actor,
  appointmentId,
  extraInfo,
  actions,
  onChanged,
}: {
  item: TreatmentRowItem
  actor: TreatmentPlanActor
  appointmentId?: string
  extraInfo?: ReactNode
  actions?: ReactNode
  onChanged?: () => void
}) {
  const progress = deriveItemProgress(item)
  const progressLabel =
    progress === "partial" ? `${item.completedToothNumbers.length}/${item.toothNumbers.length} Diş Tamamlandı` : undefined

  return (
    <div className="@container">
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card py-3 pr-3 pl-4 transition-shadow duration-200 hover:shadow-sm @md:flex-row @md:items-start">
        <TreatmentProgressBar progress={progress} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate font-medium">{item.treatmentName}</span>
            <TreatmentProgressBadge progress={progress} label={progressLabel} />
          </div>
          {item.toothNumbers.length > 0 && (
            <ToothChips toothNumbers={item.toothNumbers} completedToothNumbers={item.completedToothNumbers} />
          )}
          <p className="text-xs text-muted-foreground">
            {item.providerName}
            {extraInfo}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 @md:flex-col @md:items-end">
          <span className="font-semibold tabular-nums">
            {item.totalPrice === null ? "Belirlenmedi" : formatCurrency(item.totalPrice, item.currency)}
          </span>
          <div className="flex items-center gap-1">
            <CompleteTreatmentControl item={item} actor={actor} appointmentId={appointmentId} onChanged={onChanged} />
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Plan-detail row: the shared row plus edit/delete and the owner-only hekim payı. */
function TreatmentPlanItemRow({
  item,
  isOwner,
  actor,
  onEdit,
  onDataChanged,
}: {
  item: TreatmentPlanItemDetail
  isOwner: boolean
  actor: TreatmentPlanActor
  onEdit: () => void
  onDataChanged?: () => void
}) {
  const router = useRouter()

  return (
    <TreatmentItemRow
      item={item}
      actor={actor}
      onChanged={onDataChanged}
      extraInfo={
        isOwner && item.providerShareAmount != null
          ? ` · Hekim payı ${formatCurrency(item.providerShareAmount, item.currency)}`
          : null
      }
      actions={
        <>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Düzenle" onClick={onEdit}>
            <Pencil />
          </Button>
          {canDeleteTreatmentPlanItem(actor) && (
            <EntityDeleteDialog
              title={`"${item.treatmentName}" kalemi silinsin mi?`}
              description="Bu kalem aktif ekranlardan kaldırılır. Plan ve tamamlanan işlemler etkilenmez, kayıt kalıcı olarak silinmez."
              triggerLabel=""
              triggerIcon={Trash2}
              triggerVariant="ghost"
              triggerSize="icon-sm"
              triggerClassName="text-destructive hover:text-destructive"
              confirmVariant="destructive"
              requireReason
              reasonLabel="Silme sebebi"
              reasonPlaceholder="Bu kalemi neden siliyorsunuz?"
              onConfirm={async (reason) => {
                const result = await deleteTreatmentPlanItem({ itemId: item.id, reason })
                if (result?.success) {
                  router.refresh()
                  onDataChanged?.()
                  return undefined
                }
                return { error: result?.error ?? "Tedavi kalemi silinemedi." }
              }}
            />
          )}
        </>
      }
    />
  )
}

export { TreatmentItemRow, TreatmentPlanItemRow }

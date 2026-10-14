"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { InfoGrid } from "@/components/shared/info-grid"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { currencySymbol, formatCurrency } from "@/lib/format/currency"
import type { AssignableStaff } from "@/lib/staff/queries"
import { deleteTreatmentPlan } from "@/lib/treatment-plans/actions"
import { TREATMENT_PAYMENT_METHOD_LABELS } from "@/lib/treatment-plans/constants"
import {
  canCorrectPayment,
  canDeleteTreatmentPlan,
  canRecordPayment,
  type TreatmentPlanActor,
} from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanDetail, TreatmentPlanItemDetail } from "@/lib/treatment-plans/queries"
import { AddTreatmentPlanPaymentSheet } from "./add-treatment-plan-payment-sheet"
import { TreatmentPlanItemEditSheet } from "./treatment-plan-item-edit-sheet"
import { TreatmentPlanItemRow } from "./treatment-plan-item-row"
import { TreatmentPlanPaymentCorrectionSheet } from "./treatment-plan-payment-correction-sheet"

/**
 * A plan's detail body — treatment rows, then (optionally) totals and
 * payments, then delete. Rendered inline under the plan on the patient card
 * (2026-10-14, `showFinancials={false}`: the card's own "Ödemeler" section
 * already shows money) and inside the Dashboard drill-down's
 * `TreatmentPlanDetailSheet`. Mutations refresh the route; `onDataChanged`
 * additionally lets a host that fetched `plan` on the client (the Dashboard
 * sheet) reload its copy, which a route refresh alone would not update.
 */
function TreatmentPlanDetailContent({
  plan,
  isOwner,
  providers,
  actor,
  showFinancials = true,
  onDataChanged,
  onDeleted,
}: {
  plan: TreatmentPlanDetail
  isOwner: boolean
  providers: AssignableStaff[]
  actor: TreatmentPlanActor
  showFinancials?: boolean
  onDataChanged?: () => void
  onDeleted?: () => void
}) {
  const router = useRouter()
  const [editingItem, setEditingItem] = useState<TreatmentPlanItemDetail | null>(null)

  function handleChanged() {
    router.refresh()
    onDataChanged?.()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {plan.items.map((item) => (
          <TreatmentPlanItemRow
            key={item.id}
            item={item}
            isOwner={isOwner}
            actor={actor}
            onEdit={() => setEditingItem(item)}
            onDataChanged={onDataChanged}
          />
        ))}
      </div>

      {showFinancials && (
        <>
          <InfoGrid
            items={
              plan.currencyTotals.length === 0
                ? [
                    { label: "Toplam", value: "Belirlenmedi" },
                    { label: "Ödenen", value: formatCurrency(0, "TRY") },
                    { label: "Kalan", value: "Belirlenmedi" },
                  ]
                : plan.currencyTotals.flatMap((entry) => {
                    const suffix = plan.currencyTotals.length > 1 ? ` (${currencySymbol(entry.currency)})` : ""
                    return [
                      { label: `Toplam${suffix}`, value: entry.total === null ? "Belirlenmedi" : formatCurrency(entry.total, entry.currency) },
                      { label: `Ödenen${suffix}`, value: formatCurrency(entry.paid, entry.currency) },
                      { label: `Kalan${suffix}`, value: entry.remaining === null ? "Belirlenmedi" : formatCurrency(entry.remaining, entry.currency) },
                    ]
                  })
            }
          />

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Ödemeler</span>
              {canRecordPayment(actor) && (
                <AddTreatmentPlanPaymentSheet
                  treatmentPlanId={plan.id}
                  currencyBalances={plan.currencyTotals.map((entry) => ({
                    currency: entry.currency,
                    remaining: entry.remaining,
                  }))}
                  onSuccess={handleChanged}
                />
              )}
            </div>

            {plan.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz ödeme kaydı yok.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {plan.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">
                      {format(new Date(payment.paidAt), "d MMM yyyy", { locale: tr })} ·{" "}
                      {formatCurrency(payment.amount, payment.currency)} · {TREATMENT_PAYMENT_METHOD_LABELS[payment.method]}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {payment.entryType !== "payment" && (
                        <Badge variant="warning">{payment.entryType === "refund" ? "İade" : "Düzeltme"}</Badge>
                      )}
                      {payment.entryType === "payment" && canCorrectPayment(actor) && (
                        <TreatmentPlanPaymentCorrectionSheet
                          treatmentPlanId={plan.id}
                          payment={payment}
                          onSuccess={handleChanged}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {canDeleteTreatmentPlan(actor) && (
        <>
          <Separator />
          <EntityDeleteDialog
            title={`"${plan.planName}" planı silinsin mi?`}
            description="Plan ve altındaki tüm kalemler aktif ekranlardan kaldırılır. Randevular ve tamamlanan işlemler etkilenmez, kayıt kalıcı olarak silinmez."
            triggerLabel="Planı Sil"
            triggerSize="sm"
            triggerClassName="self-start"
            showReason
            reasonLabel="Silme sebebi (opsiyonel)"
            reasonPlaceholder="Bu planı neden siliyorsunuz? (opsiyonel)"
            onConfirm={async (reason) => {
              const result = await deleteTreatmentPlan({ planId: plan.id, reason })
              if (result?.success) {
                onDeleted?.()
                router.refresh()
                return undefined
              }
              return { error: result?.error ?? "Tedavi planı silinemedi." }
            }}
          />
        </>
      )}

      {editingItem && (
        <TreatmentPlanItemEditSheet
          item={editingItem}
          providers={providers}
          open={editingItem !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingItem(null)
          }}
          onSaved={onDataChanged}
        />
      )}
    </div>
  )
}

export { TreatmentPlanDetailContent }

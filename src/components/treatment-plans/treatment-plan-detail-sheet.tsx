"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { InfoGrid } from "@/components/shared/info-grid"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
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
import { TreatmentPlanItemCard } from "./treatment-plan-item-card"
import { TreatmentPlanItemEditSheet } from "./treatment-plan-item-edit-sheet"
import { TreatmentPlanPaymentCorrectionSheet } from "./treatment-plan-payment-correction-sheet"
import { TreatmentPlanStatusBadge } from "./treatment-plan-status-badge"

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

/**
 * Plan Detail Sheet — hasta kartındaki plan listesinden açılır. Sprint 28C:
 * artık `getPatientTreatmentPlans` ile sunucuda önceden çekilmiş gerçek
 * `TreatmentPlanDetail` prop'unu gösterir (mock state yok). Kalem düzenleme
 * kendi Sheet'i içinde `router.refresh()` çağırdığından burada ayrıca local
 * state tutmaya gerek yok — `plan` prop'u sayfa yenilendiğinde güncel gelir.
 */
function TreatmentPlanDetailSheet({
  plan,
  isOwner,
  providers,
  actor,
  open,
  onOpenChange,
}: {
  plan: TreatmentPlanDetail
  isOwner: boolean
  providers: AssignableStaff[]
  actor: TreatmentPlanActor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [editingItem, setEditingItem] = useState<TreatmentPlanItemDetail | null>(null)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {plan.planName}
              <TreatmentPlanStatusBadge status={plan.status} />
            </SheetTitle>
            <SheetDescription>
              Oluşturma tarihi: {format(new Date(plan.createdAt), "d MMMM yyyy", { locale: tr })}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 pb-4">
            <div className="flex flex-col gap-2">
              {plan.items.map((item) => (
                <TreatmentPlanItemCard
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  actor={actor}
                  staffOptions={providers}
                  onEdit={() => setEditingItem(item)}
                />
              ))}
            </div>

            <Separator />

            <InfoGrid
              items={[
                { label: "Toplam", value: plan.totalAmount === null ? "Belirlenmedi" : formatMoney(plan.totalAmount) },
                { label: "Ödenen", value: formatMoney(plan.paidAmount) },
                {
                  label: "Kalan",
                  value: plan.remainingBalance === null ? "Belirlenmedi" : formatMoney(plan.remainingBalance),
                },
              ]}
            />

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Ödemeler</span>
                {canRecordPayment(actor) && (
                  <AddTreatmentPlanPaymentSheet
                    treatmentPlanId={plan.id}
                    remainingBalance={plan.remainingBalance}
                    onSuccess={() => router.refresh()}
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
                        {formatMoney(payment.amount)} · {TREATMENT_PAYMENT_METHOD_LABELS[payment.method]}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {payment.entryType !== "payment" && (
                          <Badge variant="warning">
                            {payment.entryType === "refund" ? "İade" : "Düzeltme"}
                          </Badge>
                        )}
                        {payment.entryType === "payment" && canCorrectPayment(actor) && (
                          <TreatmentPlanPaymentCorrectionSheet
                            treatmentPlanId={plan.id}
                            payment={payment}
                            onSuccess={() => router.refresh()}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canDeleteTreatmentPlan(actor) && (
              <>
                <Separator />
                <EntityDeleteDialog
                  title={`"${plan.planName}" planı silinsin mi?`}
                  description="Plan ve altındaki tüm kalemler aktif ekranlardan kaldırılır. Randevular ve tamamlanmış seanslar etkilenmez, kayıt kalıcı olarak silinmez."
                  triggerLabel="Planı Sil"
                  requireReason
                  reasonLabel="Silme sebebi"
                  reasonPlaceholder="Bu planı neden siliyorsunuz?"
                  onConfirm={async (reason) => {
                    const result = await deleteTreatmentPlan({ planId: plan.id, reason })
                    if (result?.success) {
                      onOpenChange(false)
                      router.refresh()
                      return undefined
                    }
                    return { error: result?.error ?? "Tedavi planı silinemedi." }
                  }}
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {editingItem && (
        <TreatmentPlanItemEditSheet
          item={editingItem}
          providers={providers}
          open={editingItem !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingItem(null)
          }}
        />
      )}
    </>
  )
}

export { TreatmentPlanDetailSheet }

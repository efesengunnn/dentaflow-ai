"use client"

import { ClipboardList } from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import type { AssignableStaff } from "@/lib/staff/queries"
import { formatCurrency } from "@/lib/format/currency"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { TreatmentPlanDetailSheet } from "./treatment-plan-detail-sheet"
import { TreatmentPlanStatusBadge } from "./treatment-plan-status-badge"

/** Per-currency plan total for the list subtitle, e.g. "12.000 ₺ + 600 €". */
function formatPlanTotals(plan: TreatmentPlanDetail): string {
  const priced = plan.currencyTotals.filter((entry) => entry.total !== null)
  if (priced.length === 0) return "Belirlenmedi"
  return priced.map((entry) => formatCurrency(entry.total ?? 0, entry.currency)).join(" + ")
}

/**
 * Hasta kartının "Tedavi Planları (Yeni)" bölümündeki plan listesi —
 * `TreatmentSeriesCard`'ın tıkla-detayı-aç deseniyle aynı, sadece plan
 * seviyesinde. Sprint 28C: gerçek `getPatientTreatmentPlans` sonucunu
 * gösterir.
 */
function TreatmentPlanList({
  plans,
  isOwner,
  providers,
  actor,
}: {
  plans: TreatmentPlanDetail[]
  isOwner: boolean
  providers: AssignableStaff[]
  actor: TreatmentPlanActor
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Henüz aktif tedavi planı yok"
        description="“Randevu Oluştur” dediğinizde tedavi planı oluşturma adımları otomatik açılacak."
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            size="sm"
            role="button"
            tabIndex={0}
            onClick={() => setSelectedPlanId(plan.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setSelectedPlanId(plan.id)
            }}
            className="cursor-pointer transition-colors duration-150 hover:bg-muted/40"
          >
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1 truncate font-medium">{plan.planName}</span>
                <TreatmentPlanStatusBadge status={plan.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {plan.items.length} kalem · {formatPlanTotals(plan)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPlan && (
        <TreatmentPlanDetailSheet
          plan={selectedPlan}
          isOwner={isOwner}
          providers={providers}
          actor={actor}
          open={selectedPlan !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedPlanId(null)
          }}
        />
      )}
    </>
  )
}

export { TreatmentPlanList }

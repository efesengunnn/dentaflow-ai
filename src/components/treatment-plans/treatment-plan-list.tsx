"use client"

import { ChevronDown, ClipboardList } from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatCurrency } from "@/lib/format/currency"
import type { AssignableStaff } from "@/lib/staff/queries"
import { derivePlanProgress } from "@/lib/treatment-plans/constants"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { TreatmentPlanDetailContent } from "./treatment-plan-detail-content"
import { TreatmentPlanProgressBadge } from "./treatment-plan-status-badge"
import { TreatmentProgressBar } from "./treatment-progress-badge"

/** Per-currency plan total for the list subtitle, e.g. "12.000 ₺ + 600 €". */
function formatPlanTotals(plan: TreatmentPlanDetail): string {
  const priced = plan.currencyTotals.filter((entry) => entry.total !== null)
  if (priced.length === 0) return "Belirlenmedi"
  return priced.map((entry) => formatCurrency(entry.total ?? 0, entry.currency)).join(" + ")
}

/**
 * Hasta kartının "Tedavi Planları" bölümü. 2026-10-14: a plan opens its
 * detail inline, right under itself (no side sheet) — click the plan header
 * to expand/collapse. Several plans can be open at once.
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
  const [openPlanIds, setOpenPlanIds] = useState<string[]>([])

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Henüz aktif tedavi planı yok"
        description="“Randevu Oluştur” dediğinizde tedavi planı oluşturma adımları otomatik açılacak."
      />
    )
  }

  function setPlanOpen(planId: string, open: boolean) {
    setOpenPlanIds((current) => (open ? [...current, planId] : current.filter((id) => id !== planId)))
  }

  return (
    <div className="flex flex-col gap-2">
      {plans.map((plan) => (
        <Collapsible
          key={plan.id}
          open={openPlanIds.includes(plan.id)}
          onOpenChange={(open) => setPlanOpen(plan.id, open)}
        >
          <Card size="sm" className="relative gap-0 py-0">
            <TreatmentProgressBar progress={derivePlanProgress(plan)} />
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center gap-3 py-3 pr-3 pl-4 text-left transition-colors duration-150 hover:bg-muted/40"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 truncate font-medium">{plan.planName}</span>
                    <TreatmentPlanProgressBadge plan={plan} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.items.length} tedavi · {formatPlanTotals(plan)}
                  </p>
                </div>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className="border-t px-3 py-4 sm:px-4">
                <TreatmentPlanDetailContent
                  plan={plan}
                  isOwner={isOwner}
                  providers={providers}
                  actor={actor}
                  showFinancials={false}
                />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  )
}

export { TreatmentPlanList }

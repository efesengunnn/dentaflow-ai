"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AssignableStaff } from "@/lib/staff/queries"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { TreatmentPlanDetailContent } from "./treatment-plan-detail-content"
import { TreatmentPlanProgressBadge } from "./treatment-plan-status-badge"

/**
 * Plan Detail Sheet — only the Dashboard's "Bekleyen Bakiye" / "Bu Ay Toplam
 * Ciro" drill-downs open a plan this way now; the patient card shows the same
 * `TreatmentPlanDetailContent` inline under the plan instead (2026-10-14).
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {plan.planName}
            <TreatmentPlanProgressBadge plan={plan} />
          </SheetTitle>
          <SheetDescription>
            Oluşturma tarihi: {format(new Date(plan.createdAt), "d MMMM yyyy", { locale: tr })}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <TreatmentPlanDetailContent
            plan={plan}
            isOwner={isOwner}
            providers={providers}
            actor={actor}
            onDeleted={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { TreatmentPlanDetailSheet }

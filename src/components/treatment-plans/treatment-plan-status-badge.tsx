import { Badge } from "@/components/ui/badge"
import {
  derivePlanProgress,
  TREATMENT_PLAN_STATUS_BADGE_VARIANT,
  TREATMENT_PLAN_STATUS_LABELS,
  type TreatmentLifecycleStatus,
} from "@/lib/treatment-plans/constants"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { TreatmentProgressBadge } from "./treatment-progress-badge"

function TreatmentPlanStatusBadge({ status }: { status: TreatmentLifecycleStatus }) {
  return <Badge variant={TREATMENT_PLAN_STATUS_BADGE_VARIANT[status]}>{TREATMENT_PLAN_STATUS_LABELS[status]}</Badge>
}

/** A plan's headline badge: the 3-colour progress, or its lifecycle label once cancelled/voided (progress means nothing then). */
function TreatmentPlanProgressBadge({ plan }: { plan: Pick<TreatmentPlanDetail, "status" | "items"> }) {
  if (plan.status === "cancelled" || plan.status === "voided") return <TreatmentPlanStatusBadge status={plan.status} />
  return <TreatmentProgressBadge progress={derivePlanProgress(plan)} />
}

export { TreatmentPlanProgressBadge, TreatmentPlanStatusBadge }

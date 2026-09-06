import { Badge } from "@/components/ui/badge"
import {
  TREATMENT_PLAN_STATUS_BADGE_VARIANT,
  TREATMENT_PLAN_STATUS_LABELS,
  type TreatmentLifecycleStatus,
} from "@/lib/treatment-plans/constants"

function TreatmentPlanStatusBadge({ status }: { status: TreatmentLifecycleStatus }) {
  return <Badge variant={TREATMENT_PLAN_STATUS_BADGE_VARIANT[status]}>{TREATMENT_PLAN_STATUS_LABELS[status]}</Badge>
}

export { TreatmentPlanStatusBadge }

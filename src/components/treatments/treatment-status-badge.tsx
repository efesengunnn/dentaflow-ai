import { Badge } from "@/components/ui/badge"
import {
  TREATMENT_STATUS_BADGE_VARIANT,
  TREATMENT_STATUS_LABELS,
  type TreatmentLifecycleStatus,
} from "@/lib/treatments/constants"

function TreatmentStatusBadge({ status }: { status: TreatmentLifecycleStatus }) {
  return <Badge variant={TREATMENT_STATUS_BADGE_VARIANT[status]}>{TREATMENT_STATUS_LABELS[status]}</Badge>
}

export { TreatmentStatusBadge }

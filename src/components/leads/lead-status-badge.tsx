import { Badge } from "@/components/ui/badge"
import { LEAD_STATUS_BADGE_VARIANT, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads/constants"

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={LEAD_STATUS_BADGE_VARIANT[status]}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  )
}

export { LeadStatusBadge }

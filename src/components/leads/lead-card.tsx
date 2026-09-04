import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { LEAD_SOURCE_LABELS } from "@/lib/leads/constants"
import type { LeadListRow } from "@/lib/leads/queries"
import { LeadStatusBadge } from "./lead-status-badge"

function LeadCard({ lead }: { lead: LeadListRow }) {
  return (
    <Link href={`/leads/${lead.id}`}>
      <Card className="transition-colors duration-150 hover:bg-muted/40">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-medium" title={lead.fullName}>
              {lead.fullName}
            </span>
            <LeadStatusBadge status={lead.status} />
          </div>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <span className="font-mono">{formatTurkishPhoneDisplay(lead.phone)}</span>
            <span className="truncate">
              {LEAD_SOURCE_LABELS[lead.source]}
              {lead.assignedToName ? ` · ${lead.assignedToName}` : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export { LeadCard }

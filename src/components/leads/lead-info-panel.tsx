import { format } from "date-fns"
import { tr } from "date-fns/locale"

import { InfoRow } from "@/components/shared/info-row"
import { Card, CardContent } from "@/components/ui/card"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { LEAD_SOURCE_LABELS } from "@/lib/leads/constants"
import type { LeadDetail } from "@/lib/leads/queries"
import { LeadStatusBadge } from "./lead-status-badge"

function LeadInfoPanel({ lead }: { lead: LeadDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <InfoRow label="Ad Soyad" value={lead.fullName} />
        <InfoRow
          label="Telefon"
          value={<span className="font-mono">{formatTurkishPhoneDisplay(lead.phone)}</span>}
        />
        <InfoRow label="E-posta" value={lead.email ?? "—"} />
        <InfoRow label="Kaynak" value={LEAD_SOURCE_LABELS[lead.source]} />
        <InfoRow label="Durum" value={<LeadStatusBadge status={lead.status} />} />
        <InfoRow label="Sorumlu Personel" value={lead.assignedToName ?? "Atanmamış"} />
        <InfoRow
          label="Oluşturulma Tarihi"
          value={format(new Date(lead.createdAt), "d MMMM yyyy", { locale: tr })}
        />
      </CardContent>
    </Card>
  )
}

export { LeadInfoPanel }

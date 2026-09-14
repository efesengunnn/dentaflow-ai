import { format } from "date-fns"
import { tr } from "date-fns/locale"
import Link from "next/link"

import { InfoRow } from "@/components/shared/info-row"
import { Card, CardContent } from "@/components/ui/card"
import { formatIstanbulDateTime } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { AppointmentDetail } from "@/lib/appointments/queries"
import { AppointmentStatusBadge } from "./appointment-status-badge"

function AppointmentInfoPanel({ appointment }: { appointment: AppointmentDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <InfoRow
          label="Hasta"
          value={
            <Link href={`/patients/${appointment.patientId}`} className="text-primary hover:underline">
              {appointment.patientName}
            </Link>
          }
        />
        <InfoRow
          label="Telefon"
          value={<span className="font-mono">{formatTurkishPhoneDisplay(appointment.patientPhone)}</span>}
        />
        <InfoRow label="Hekim" value={appointment.staffName} />
        <InfoRow
          label="Randevu Saati"
          value={formatIstanbulDateTime(appointment.startsAt, { day: "numeric", month: "long", year: "numeric" })}
        />
        <InfoRow label="Sebep" value={appointment.reason ?? "—"} />
        <InfoRow label="Durum" value={<AppointmentStatusBadge status={appointment.status} />} />
        <InfoRow
          label="Oluşturulma Tarihi"
          value={format(new Date(appointment.createdAt), "d MMMM yyyy", { locale: tr })}
        />
      </CardContent>
    </Card>
  )
}

export { AppointmentInfoPanel }

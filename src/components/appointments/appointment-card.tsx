import { Package, Wallet } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { formatIstanbulDateTime } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { getInitials } from "@/lib/utils"
import { AppointmentStatusBadge } from "./appointment-status-badge"

function AppointmentCard({ appointment }: { appointment: AppointmentListRow }) {
  const { linkedTreatment } = appointment
  const hasBalanceDue = linkedTreatment !== null && linkedTreatment.remainingBalance !== null && linkedTreatment.remainingBalance > 0

  return (
    <Link href={`/appointments/${appointment.id}`}>
      <Card className="transition-shadow duration-150 hover:shadow-md">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(appointment.patientName)}
              </div>
              <span className="min-w-0 truncate font-medium" title={appointment.patientName}>
                {appointment.patientName}
              </span>
            </div>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <span className="font-mono">
              {formatIstanbulDateTime(appointment.startsAt, { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="truncate">{appointment.staffName}</span>
            <span className="font-mono">{formatTurkishPhoneDisplay(appointment.patientPhone)}</span>
          </div>
          {(linkedTreatment || appointment.procedureName) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="gap-1">
                <Package />
                {linkedTreatment
                  ? `${linkedTreatment.treatmentType} · ${linkedTreatment.sessionNumber}/${linkedTreatment.totalSessions} Seans`
                  : appointment.procedureName}
              </Badge>
              {hasBalanceDue && (
                <Badge variant="warning" className="gap-1">
                  <Wallet />
                  Tahsilat Bekliyor
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export { AppointmentCard }

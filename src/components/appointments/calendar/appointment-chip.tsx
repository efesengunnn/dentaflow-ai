import Link from "next/link"

import { cn } from "@/lib/utils"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { formatIstanbulTime } from "@/lib/format/date"

/** Left-border accent per status — same semantic intent as `AppointmentStatusBadge`'s variant map, in chip form. */
const STATUS_ACCENT: Record<AppointmentStatus, string> = {
  scheduled: "border-l-muted-foreground/40",
  confirmed: "border-l-primary",
  completed: "border-l-success",
  cancelled: "border-l-warning",
  no_show: "border-l-warning",
}

/**
 * A secretary glancing at the calendar needs "what is this patient here
 * for" without opening anything: time + patient name, plus a truncated
 * third line combining İşlem (`reason`) and personel — both already fetched
 * by `AppointmentListRow`, no extra query.
 */
function AppointmentChip({ appointment }: { appointment: AppointmentListRow }) {
  const time = formatIstanbulTime(appointment.startsAt)
  const detail = [appointment.reason, appointment.staffName].filter(Boolean).join(" · ")

  return (
    <Link
      href={`/patients/${appointment.patientId}`}
      className={cn(
        "flex min-w-0 flex-col gap-0 rounded-md border-l-2 bg-muted/60 px-1.5 py-1 text-left text-xs leading-tight shadow-xs transition-all duration-150 hover:bg-muted hover:shadow-sm",
        STATUS_ACCENT[appointment.status],
      )}
    >
      <span className="flex items-center gap-1 font-mono font-medium">{time}</span>
      <span className="truncate" title={appointment.patientName}>
        {appointment.patientName}
      </span>
      {detail && (
        <span className="truncate text-muted-foreground" title={detail}>
          {detail}
        </span>
      )}
    </Link>
  )
}

export { AppointmentChip, STATUS_ACCENT }

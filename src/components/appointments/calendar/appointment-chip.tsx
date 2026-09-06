import { Wallet } from "lucide-react"
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
 * Sprint 15 — a secretary glancing at the calendar needs "what is this
 * patient here for" without opening anything: time + patient name (as
 * before) plus, on one more truncated line, İşlem (`reason`) and personel
 * — both already fetched by `AppointmentListRow`, no extra query. Combined
 * into a single line (not two) to keep chip height from ballooning inside
 * Month view's `MAX_VISIBLE_PER_DAY` cells.
 *
 * Sprint 18 — when a treatment is linked, that third line switches to
 * "Paket adı · N/Toplam Seans" (more useful at a glance than the generic
 * reason/personel line) and a small wallet icon appears next to the time
 * when the linked series has a balance due — still one line, chip height
 * unchanged.
 */
function AppointmentChip({ appointment }: { appointment: AppointmentListRow }) {
  const time = formatIstanbulTime(appointment.startsAt)
  const { linkedTreatment } = appointment
  const hasBalanceDue = linkedTreatment !== null && linkedTreatment.remainingBalance !== null && linkedTreatment.remainingBalance > 0
  const detail = linkedTreatment
    ? `${linkedTreatment.treatmentType} · ${linkedTreatment.sessionNumber}/${linkedTreatment.totalSessions} Seans`
    : [appointment.procedureName ?? appointment.reason, appointment.staffName].filter(Boolean).join(" · ")

  return (
    <Link
      href={`/patients/${appointment.patientId}`}
      className={cn(
        "flex min-w-0 flex-col gap-0 rounded-md border-l-2 bg-muted/60 px-1.5 py-1 text-left text-xs leading-tight shadow-xs transition-all duration-150 hover:bg-muted hover:shadow-sm",
        STATUS_ACCENT[appointment.status],
      )}
    >
      <span className="flex items-center gap-1 font-mono font-medium">
        {time}
        {hasBalanceDue && <Wallet className="size-3 shrink-0 text-warning" aria-label="Tahsilat bekliyor" />}
      </span>
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

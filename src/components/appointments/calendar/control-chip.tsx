import { CalendarCheck } from "lucide-react"
import Link from "next/link"

import type { CalendarControlEntry } from "@/lib/appointments/queries"

/**
 * Sprint 31 — the calendar marker for a "Kontrol Günü" derived from an
 * appointment's `control_date` (founder decision 2026-09-11: a control date
 * shows on the calendar automatically, as a distinct marker rather than a real
 * appointment row). Visually separate from `AppointmentChip` — a violet accent
 * + "Kontrol" label + calendar-check icon — so a control is never mistaken for
 * a booked visit at a glance. Links back to the source appointment.
 */
function ControlChip({ entry }: { entry: CalendarControlEntry }) {
  return (
    <Link
      href={`/appointments/${entry.sourceAppointmentId}`}
      className="flex min-w-0 flex-col gap-0 rounded-md border-l-2 border-l-violet-500 bg-violet-500/10 px-1.5 py-1 text-left text-xs leading-tight shadow-xs transition-all duration-150 hover:bg-violet-500/20 hover:shadow-sm"
    >
      <span className="flex items-center gap-1 font-medium text-violet-700 dark:text-violet-300">
        <CalendarCheck className="size-3 shrink-0" />
        Kontrol
      </span>
      <span className="truncate" title={entry.patientName}>
        {entry.patientName}
      </span>
      {entry.procedureName && (
        <span className="truncate text-muted-foreground" title={entry.procedureName}>
          {entry.procedureName}
        </span>
      )}
    </Link>
  )
}

export { ControlChip }

"use client"

import { format, isSameDay, isSameMonth, isToday } from "date-fns"

import { cn } from "@/lib/utils"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { dayKey, enumerateDays, groupAppointmentsByDay, type DateRange } from "./calendar-utils"
import { AppointmentChip } from "./appointment-chip"
import { DayAppointmentsPopover } from "./day-appointments-popover"

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
const MAX_VISIBLE_PER_DAY = 3

/**
 * Full month grid, fed by a single `getAppointmentsForCalendarRange` query
 * for the whole visible range (no per-day fetch). Horizontally scrollable
 * on narrow viewports (`min-w-[640px]`) rather than shrinking cells past
 * readability — founder's "mobile Month view can simplify" allowance, but
 * still fully usable, not degraded to a placeholder.
 *
 * Sprint 11: each cell is now a click target (`onDayClick`) — an empty day
 * opens the New Appointment Sheet, a day with appointments selects it for
 * the agenda list below. The chip/overflow-popover area stops the click
 * from bubbling to the cell (they're already their own `<Link>`s — a day
 * cell can't be an `<a>` itself without nesting anchors).
 */
function MonthView({
  anchorMonth,
  range,
  rows,
  selectedDay,
  onDayClick,
}: {
  anchorMonth: Date
  range: DateRange
  rows: AppointmentListRow[]
  selectedDay: Date
  onDayClick: (day: Date, hasAppointments: boolean) => void
}) {
  const days = enumerateDays(range)
  const byDay = groupAppointmentsByDay(rows)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day)
            const dayAppointments = byDay.get(key) ?? []
            const visible = dayAppointments.slice(0, MAX_VISIBLE_PER_DAY)
            const overflow = dayAppointments.slice(MAX_VISIBLE_PER_DAY)
            const outsideMonth = !isSameMonth(day, anchorMonth)
            const hasAppointments = dayAppointments.length > 0
            const selected = isSameDay(day, selectedDay)

            return (
              // Not a native <button> — the cell contains its own
              // `AppointmentChip` `<Link>`s, and a <button>/<a> can't
              // legally nest another interactive/anchor element. A div with
              // button semantics (same accessible-custom-row pattern as
              // `DataTable`'s `onRowClick`) avoids that while staying
              // keyboard-operable.
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => onDayClick(day, hasAppointments)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onDayClick(day, hasAppointments)
                  }
                }}
                className={cn(
                  "outline-none flex min-h-28 cursor-pointer flex-col gap-1 border-b border-r p-1.5 text-left transition-colors [&:nth-child(7n)]:border-r-0",
                  "hover:bg-muted/40 focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:-outline-offset-2",
                  outsideMonth && "bg-muted/20",
                  hasAppointments && !outsideMonth && "bg-primary/5",
                  selected && "ring-primary ring-2 ring-inset",
                )}
              >
                <span
                  className={cn(
                    "self-start rounded-full px-1.5 text-xs",
                    outsideMonth && "text-muted-foreground/50",
                    isToday(day) && "bg-primary font-medium text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                <div
                  className="flex flex-col gap-1"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {visible.map((appointment) => (
                    <AppointmentChip key={appointment.id} appointment={appointment} />
                  ))}
                  {overflow.length > 0 && (
                    <DayAppointmentsPopover date={day} appointments={overflow} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { MonthView }

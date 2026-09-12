"use client"

import { format, isSameDay, isToday } from "date-fns"
import { tr } from "date-fns/locale"

import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import { CalendarDays } from "lucide-react"
import type { AppointmentListRow, CalendarControlEntry } from "@/lib/appointments/queries"
import { dayKey, enumerateDays, groupAppointmentsByDay, groupControlEntriesByDay, type DateRange } from "./calendar-utils"
import { AppointmentChip } from "./appointment-chip"
import { ControlChip } from "./control-chip"
import { DayAppointmentsPopover } from "./day-appointments-popover"

const MAX_VISIBLE_PER_DAY = 3

/**
 * Two parallel render branches (`hidden sm:block` / `sm:hidden`) reading the
 * same grouped rows — same responsive philosophy as `EntityTableSection`'s
 * desktop-table/mobile-card split, not a JS media-query hook. Founder
 * requirement (Sprint 6 planning): Week must be *fully* usable on mobile,
 * not just simplified like Month — so the mobile branch is a real per-day
 * agenda list, not a shrunk grid.
 *
 * Sprint 11: the desktop grid gets the same day-click behavior as Month
 * view (empty day → New Appointment Sheet, non-empty → select for the
 * agenda list below). The mobile branch already shows every day's full
 * agenda inline — no "select a day to see more" need there, left as-is.
 *
 * Sprint 15: the desktop grid now caps at `MAX_VISIBLE_PER_DAY` + the same
 * "+N daha" overflow popover Month view already uses — a busy day no longer
 * stretches the whole week's row height. Mobile stays uncapped (already a
 * real scrolling list, not a fixed-height grid cell — no density problem
 * there).
 */
function WeekView({
  range,
  rows,
  controlEntries,
  selectedDay,
  onDayClick,
}: {
  range: DateRange
  rows: AppointmentListRow[]
  controlEntries: CalendarControlEntry[]
  selectedDay: Date
  onDayClick: (day: Date, hasContent: boolean) => void
}) {
  const days = enumerateDays(range)
  const byDay = groupAppointmentsByDay(rows)
  const controlsByDay = groupControlEntriesByDay(controlEntries)

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <div className="grid min-w-[840px] grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day)
            const dayAppointments = byDay.get(key) ?? []
            const dayControls = controlsByDay.get(key) ?? []
            const visible = dayAppointments.slice(0, MAX_VISIBLE_PER_DAY)
            const overflow = dayAppointments.slice(MAX_VISIBLE_PER_DAY)
            const hasContent = dayAppointments.length > 0 || dayControls.length > 0
            const selected = isSameDay(day, selectedDay)
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => onDayClick(day, hasContent)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onDayClick(day, hasContent)
                  }
                }}
                className={cn(
                  "outline-none flex min-h-64 cursor-pointer flex-col gap-1.5 border-b border-r p-2 transition-colors [&:nth-child(7n)]:border-r-0",
                  "hover:bg-muted/40 focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:-outline-offset-2",
                  hasContent && "bg-primary/5",
                  selected && "ring-primary ring-2 ring-inset",
                )}
              >
                <div className="flex flex-col items-center gap-0.5 pb-1">
                  <span className="text-xs text-muted-foreground">
                    {format(day, "EEEEEE", { locale: tr })}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 text-sm",
                      isToday(day) && "bg-primary font-medium text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
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
                  {dayControls.map((entry) => (
                    <ControlChip key={`control-${entry.sourceAppointmentId}`} entry={entry} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 sm:hidden">
        {days.map((day) => {
          const key = dayKey(day)
          const dayAppointments = byDay.get(key) ?? []
          const dayControls = controlsByDay.get(key) ?? []
          return (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-medium",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                <span className="text-sm font-medium">{format(day, "EEEE", { locale: tr })}</span>
              </div>
              {dayAppointments.length === 0 && dayControls.length === 0 ? (
                <p className="pl-9 text-sm text-muted-foreground">Randevu yok</p>
              ) : (
                <div className="flex flex-col gap-1.5 pl-9">
                  {dayAppointments.map((appointment) => (
                    <AppointmentChip key={appointment.id} appointment={appointment} />
                  ))}
                  {dayControls.map((entry) => (
                    <ControlChip key={`control-${entry.sourceAppointmentId}`} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {rows.length === 0 && controlEntries.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="Bu hafta randevu yok"
            description="Yeni bir randevu oluşturduğunuzda burada görünecek."
          />
        )}
      </div>
    </>
  )
}

export { WeekView }

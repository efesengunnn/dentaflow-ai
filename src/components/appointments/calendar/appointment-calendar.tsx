"use client"

import { addDays, addMonths, format } from "date-fns"
import { tr } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AppointmentAgendaList } from "@/components/appointments/appointment-agenda-list"
import { NewAppointmentSheet } from "@/components/appointments/new-appointment-sheet"
import { PageSection } from "@/components/shared/page-section"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { localDateToDateString } from "@/lib/format/date"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { CalendarQuickNav } from "./calendar-quick-nav"
import { buildCalendarHref, dayKey, groupAppointmentsByDay, type CalendarMode, type DateRange } from "./calendar-utils"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"

/**
 * `Sprint 11` moved this from a Server Component to a Client Component:
 * clicking a calendar day now branches (empty day → open the New Appointment
 * Sheet; a day with appointments → select it, which drives the agenda list
 * below), and that branch can't be a plain `<Link>` — a day cell also
 * contains its own `AppointmentChip` links, and nesting an `<a>` inside
 * another `<a>` is invalid. The prev/next/today/mode-toggle nav above stays
 * exactly as it was (still plain `<Link>`s, still fully bookmarkable) —
 * only the grid body and the day-selection state are new.
 */
function AppointmentCalendar({
  mode,
  anchor,
  range,
  rows,
  selectedDay,
  patientOptions,
  staffOptions,
}: {
  mode: CalendarMode
  anchor: Date
  range: DateRange
  rows: AppointmentListRow[]
  selectedDay: Date
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
}) {
  const router = useRouter()
  const [newAppointmentDate, setNewAppointmentDate] = useState<Date | null>(null)

  const previousAnchor = mode === "month" ? addMonths(anchor, -1) : addDays(anchor, -7)
  const nextAnchor = mode === "month" ? addMonths(anchor, 1) : addDays(anchor, 7)
  const titleLabel =
    mode === "month"
      ? format(anchor, "MMMM yyyy", { locale: tr })
      : `${format(range.start, "d MMM", { locale: tr })} – ${format(addDays(range.end, -1), "d MMM yyyy", { locale: tr })}`

  const byDay = groupAppointmentsByDay(rows)
  const selectedDayAppointments = byDay.get(dayKey(selectedDay)) ?? []

  function handleDayClick(day: Date, hasAppointments: boolean) {
    if (hasAppointments) {
      router.push(buildCalendarHref(mode, anchor, day))
    } else {
      setNewAppointmentDate(day)
    }
  }

  function handleAppointmentCreated() {
    if (newAppointmentDate) {
      router.push(buildCalendarHref(mode, anchor, newAppointmentDate))
    }
    setNewAppointmentDate(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link href={buildCalendarHref(mode, previousAnchor)} aria-label="Önceki">
                <ChevronLeft />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildCalendarHref(mode, new Date(), new Date())}>Bugün</Link>
            </Button>
            <Button variant="outline" size="icon" asChild>
              <Link href={buildCalendarHref(mode, nextAnchor)} aria-label="Sonraki">
                <ChevronRight />
              </Link>
            </Button>
            <CalendarQuickNav anchor={anchor} label={titleLabel} mode={mode} />
          </div>

          <div className="bg-muted/50 inline-flex gap-1 rounded-xl border p-1">
            <Button variant={mode === "month" ? "default" : "ghost"} size="sm" asChild>
              <Link href={buildCalendarHref("month", anchor)}>Ay</Link>
            </Button>
            <Button variant={mode === "week" ? "default" : "ghost"} size="sm" asChild>
              <Link href={buildCalendarHref("week", anchor)}>Hafta</Link>
            </Button>
          </div>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          {mode === "month" ? (
            <MonthView
              anchorMonth={anchor}
              range={range}
              rows={rows}
              selectedDay={selectedDay}
              onDayClick={handleDayClick}
            />
          ) : (
            <WeekView range={range} rows={rows} selectedDay={selectedDay} onDayClick={handleDayClick} />
          )}
        </Card>
      </div>

      <PageSection title={format(selectedDay, "d MMMM yyyy, EEEE", { locale: tr })}>
        <AppointmentAgendaList
          appointments={selectedDayAppointments}
          emptyTitle="Bu gün için randevu bulunmuyor."
          newAppointmentHref={`/appointments/new?date=${localDateToDateString(selectedDay)}`}
          patientOptions={patientOptions}
          staffOptions={staffOptions}
        />
      </PageSection>

      <NewAppointmentSheet
        open={newAppointmentDate !== null}
        onOpenChange={(open) => {
          if (!open) setNewAppointmentDate(null)
        }}
        onCreated={handleAppointmentCreated}
        defaultDate={newAppointmentDate ? localDateToDateString(newAppointmentDate) : undefined}
        patientOptions={patientOptions}
        staffOptions={staffOptions}
      />
    </div>
  )
}

export { AppointmentCalendar }
export type { CalendarMode }

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { tr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { buildCalendarHref, type CalendarMode } from "./calendar-utils"

/**
 * Click the calendar title to jump straight to any month/year — Google/
 * Apple/Outlook-level quick navigation (Sprint 6.5 UX pass). Reuses the
 * existing `Calendar` primitive's built-in `captionLayout="dropdown"`
 * (react-day-picker) rather than a new purpose-built picker, same
 * Popover+Calendar composition `DatePicker` already uses — Design System
 * discipline: extend what exists before creating something new.
 *
 * Navigating fires the moment the month or year dropdown changes
 * (`onMonthChange`, controlled via `month`), not only after also picking a
 * specific day — the goal is a fast month/year jump, not a day-precision
 * pick, so requiring a second click would be a wasted step. Picking an
 * actual day (`onSelect`) also navigates, for the case where the user wants
 * a specific week's view.
 */
function CalendarQuickNav({
  anchor,
  label,
  mode,
}: {
  anchor: Date
  label: string
  mode: CalendarMode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  function navigateTo(date: Date | undefined) {
    if (!date) return
    setOpen(false)
    router.push(buildCalendarHref(mode, date))
  }

  // react-day-picker's dropdown year range defaults to roughly "100 years
  // back from this year" with nothing in the future when `startMonth`/
  // `endMonth` aren't set — useless for a scheduling calendar, where jumping
  // *forward* to book future appointments is the primary real-world use.
  // A clinic plans a handful of years out at most, so a tight, explicit
  // window (this year ±5) keeps the year dropdown short and relevant
  // instead of a 100-entry list nobody needs.
  const today = new Date()
  const startMonth = new Date(today.getFullYear() - 5, 0, 1)
  const endMonth = new Date(today.getFullYear() + 5, 11, 1)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-sm font-medium capitalize">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          month={anchor}
          startMonth={startMonth}
          endMonth={endMonth}
          selected={anchor}
          onMonthChange={navigateTo}
          onSelect={navigateTo}
          locale={tr}
        />
      </PopoverContent>
    </Popover>
  )
}

export { CalendarQuickNav }

import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns"

import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import type { AppointmentListRow } from "@/lib/appointments/queries"

/** Turkish work week starts Monday, not Sunday — matches `date-fns`'s `weekStartsOn` convention. */
const WEEK_STARTS_ON = 1

export type DateRange = { start: Date; end: Date }

/** Full grid the Month view renders: the month's own days plus the leading/trailing days that complete the first/last week. `end` is exclusive. */
export function getMonthGridRange(anchor: Date): DateRange {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON })
  const end = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON }), 1)
  return { start, end }
}

/** The Monday–Sunday week containing `anchor`. `end` is exclusive. */
export function getWeekRange(anchor: Date): DateRange {
  const start = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON })
  return { start, end: addDays(start, 7) }
}

/** The single calendar day containing `anchor`. `end` is exclusive. */
export function getDayRange(anchor: Date): DateRange {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  return { start, end: addDays(start, 1) }
}

/** Every date in `[start, end)`, inclusive of start, exclusive of end. */
export function enumerateDays(range: DateRange): Date[] {
  const days: Date[] = []
  let cursor = range.start
  while (cursor < range.end) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

/**
 * Groups a flat range of appointments by local calendar day — one query
 * already fetched the whole visible range (see
 * `getAppointmentsForCalendarRange`), this is a pure in-memory reshape, no
 * extra round trip per day (that would be the N+1 this module explicitly
 * avoids).
 */
export function groupAppointmentsByDay(
  rows: AppointmentListRow[],
): Map<string, AppointmentListRow[]> {
  const map = new Map<string, AppointmentListRow[]>()
  for (const row of rows) {
    const key = localDateToDateString(new Date(row.startsAt))
    const existing = map.get(key)
    if (existing) existing.push(row)
    else map.set(key, [row])
  }
  return map
}

export function dayKey(date: Date): string {
  return localDateToDateString(date)
}

export function parseAnchor(anchor: string | undefined): Date {
  return dateStringToLocalDate(anchor) ?? new Date()
}

/**
 * Sprint 11: which day the agenda list below the calendar shows. `?day=`
 * wins when present (bookmarkable, same philosophy as `anchor`/`mode`).
 * Otherwise defaults to today if today is actually in the visible grid,
 * else the first visible day — never a day the user can't see selected,
 * which would make the list below look disconnected from the calendar.
 */
export function resolveSelectedDay(dayParam: string | undefined, range: DateRange): Date {
  const fromParam = dateStringToLocalDate(dayParam)
  if (fromParam) return fromParam

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (todayStart >= range.start && todayStart < range.end) return todayStart
  return range.start
}

export type CalendarMode = "month" | "week"

/**
 * Lives here (not in `appointment-calendar.tsx`) so it's importable from
 * both the Server Component (`AppointmentCalendar`) and the Client
 * Component (`CalendarQuickNav`) without passing a function across the
 * server/client boundary — a plain closure isn't serializable as a prop
 * from a Server Component to a Client Component (RSC constraint), only the
 * `mode`/`anchor` values are.
 *
 * `day` (Sprint 11, optional) is the selected-day param — carried along on
 * every mode/anchor navigation link would be wrong (a new month/week should
 * reset which day is "selected"), so callers only pass it when they mean to
 * set/change the selection, not on the prev/next/today nav buttons.
 */
export function buildCalendarHref(mode: CalendarMode, anchor: Date, day?: Date): string {
  const base = `/appointments?view=calendar&mode=${mode}&anchor=${localDateToDateString(anchor)}`
  return day ? `${base}&day=${localDateToDateString(day)}` : base
}

/**
 * Parses a `yyyy-mm-dd` date-only string into a local `Date` without going
 * through UTC — `new Date("1990-05-14")` parses as UTC midnight, which can
 * display as the previous day in a negative-UTC-offset timezone. Used
 * anywhere a date-only value (date of birth, ...) needs to become a `Date`
 * for display or for a `DatePicker`.
 */
export function dateStringToLocalDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/** Inverse of `dateStringToLocalDate` — local `Date` back to `yyyy-mm-dd`, no UTC conversion. */
export function localDateToDateString(date?: Date): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Turkey has used a single fixed UTC+3 offset (no DST) since 2016 — this
 * lets every "Istanbul wall-clock time" helper below be a plain arithmetic
 * shift, no timezone database/library needed.
 */
const ISTANBUL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * Converts wall-clock date/time components — understood as Europe/Istanbul
 * local time — into the correct UTC instant. Deterministic regardless of
 * the running process's own timezone, unlike `new Date(y, m, d, h, mi)`
 * (which silently uses whatever timezone the process happens to be in: correct
 * on a Turkey-based dev machine, wrong by exactly 3 hours on Vercel's
 * UTC-by-default serverless runtime — the exact cause of appointment times
 * displaying 3 hours later than entered). Always use this (never
 * `new Date(y, m, d, ...)`) in server-side code that stores a `timestamptz`
 * from wall-clock date/time input.
 */
export function istanbulWallClockToUTC(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - ISTANBUL_UTC_OFFSET_MS)
}

/** The current instant, with its wall-clock components read via `nowInIstanbul().getUTC*()` reflecting Istanbul local time regardless of process timezone. */
export function nowInIstanbul(): Date {
  return new Date(Date.now() + ISTANBUL_UTC_OFFSET_MS)
}

/** Correct UTC instant for the start (00:00) of today in Istanbul, regardless of process timezone. */
export function startOfTodayIstanbul(): Date {
  const t = nowInIstanbul()
  return istanbulWallClockToUTC(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Correct UTC instant for the start (00:00, 1st) of the current month in Istanbul, regardless of process timezone. */
export function startOfMonthIstanbul(): Date {
  const t = nowInIstanbul()
  return istanbulWallClockToUTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)
}

const ISTANBUL_TIME_ZONE = "Europe/Istanbul"

/**
 * Formats a stored `timestamptz` (ISO string) for display, always in
 * Europe/Istanbul time — deterministic regardless of the rendering
 * environment's own timezone. Many appointment/patient detail views are
 * Server Components, so `date-fns`'s `format()` (which reads local Date
 * getters) silently used the server process's timezone — correct on a
 * Turkey-based dev machine, 3 hours off on Vercel's UTC-by-default
 * runtime. `Intl.DateTimeFormat`'s `timeZone` option sidesteps that
 * entirely, no library needed. `dateOptions` covers everything but the
 * time itself (day/month/year) — the `HH:mm` part is always appended.
 */
export function formatIstanbulDateTime(iso: string, dateOptions: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso)
  const datePart = new Intl.DateTimeFormat("tr-TR", { ...dateOptions, timeZone: ISTANBUL_TIME_ZONE }).format(date)
  return `${datePart}, ${formatIstanbulTime(iso)}`
}

/** Just the `HH:mm` portion, in Europe/Istanbul time — see `formatIstanbulDateTime`. */
export function formatIstanbulTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).format(new Date(iso))
}

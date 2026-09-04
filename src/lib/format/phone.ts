/**
 * Formats a raw 10-digit Turkish subscriber number into "532 123 45 67"
 * groups (3-3-2-2). Stored/passed-around values never include the leading
 * trunk "0" — `PhoneInput` shows it as a fixed, non-editable prefix instead
 * of asking the user to type it, which also removes the ambiguity a plain
 * "type everything" field would have (10 digits vs. 11 with "0" is a real
 * source of malformed grouping if not fixed to one convention).
 *
 * Pure function, no React — deliberately split out of
 * `components/ui/phone-input.tsx` (which needs `"use client"` for its event
 * handlers) so Server Components can call it directly to render a stored
 * phone number without crossing a client-module boundary ("Attempted to
 * call X from the server but X is on the client").
 */
export function formatTurkishPhone(digits: string): string {
  const trimmed = digits.slice(0, 10)
  return [trimmed.slice(0, 3), trimmed.slice(3, 6), trimmed.slice(6, 8), trimmed.slice(8, 10)]
    .filter(Boolean)
    .join(" ")
}

/** Read-only display variant with the fixed "0" trunk prefix, e.g. list/detail views. */
export function formatTurkishPhoneDisplay(digits: string): string {
  return `0 ${formatTurkishPhone(digits)}`
}

/**
 * Parses free-form phone text (Excel import cells, pasted values — spaces,
 * dashes, an optional leading trunk "0") into a clean 10-digit string, or
 * `null` if it doesn't resolve to exactly 10 digits. Used by every module's
 * Excel import parser (leads, patients, ...) — not entity-specific.
 */
export function normalizeTurkishPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  const withoutLeadingZero = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits
  return withoutLeadingZero.length === 10 ? withoutLeadingZero : null
}

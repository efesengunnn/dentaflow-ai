import type { CellValue } from "exceljs"

/**
 * Excel auto-converts anything email-shaped into a clickable hyperlink, and
 * exceljs reads that cell back as `{ text, hyperlink }`, not a plain string
 * — `String(cellValue)` on that object produces `"[object Object]"`. Also
 * handles rich-text runs and formula results, the other non-primitive shapes
 * exceljs can hand back for a single cell. Used by every module's Excel
 * import parser (leads, patients, ...) — not entity-specific.
 */
export function cellToString(value: CellValue): string {
  if (value == null) return ""
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString()
    if ("text" in value && typeof value.text === "string") return value.text
    if ("richText" in value) return value.richText.map((run) => run.text).join("")
    if ("result" in value) return cellToString(value.result ?? null)
    return ""
  }
  return String(value)
}

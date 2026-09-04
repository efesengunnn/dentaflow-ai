import { cn } from "@/lib/utils"

type TruncatedCellProps = {
  value: string | null | undefined
  maxWidthClassName?: string
  bold?: boolean
  fallback?: string
}

/**
 * The "Ad Soyad" / "Sorumlu Personel" table-cell shape — truncate long
 * values with a native tooltip (`title`), or a muted em-dash when null —
 * was identical, byte-for-byte, in `lead-columns.tsx` and
 * `patient-columns.tsx`. Extracted once that duplication was concrete.
 */
function TruncatedCell({
  value,
  maxWidthClassName = "max-w-40",
  bold = false,
  fallback = "—",
}: TruncatedCellProps) {
  if (!value) {
    return <span className="text-muted-foreground">{fallback}</span>
  }
  return (
    <span
      className={cn("block truncate", maxWidthClassName, bold && "font-medium")}
      title={value}
    >
      {value}
    </span>
  )
}

export { TruncatedCell }

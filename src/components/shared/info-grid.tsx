import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type InfoGridItem = {
  label: string
  value: ReactNode
}

/**
 * The "Ücret/Ödenen/Kalan" / "Toplam Borç/Toplam Tahsilat/Kalan Bakiye" /
 * "Son Randevu/Sonraki Randevu/Son Tahsilat" 3-column stat panel — previously
 * hand-rolled four times with three different radii/border treatments.
 * `compact` is for nesting inside an already-dense list-row card (e.g.
 * `TreatmentSeriesCard`'s mini grid).
 *
 * Sprint 20 — the label is always `text-xs` (previously the default variant
 * inherited `text-sm` from its parent, so a label like "Toplam Borç" and the
 * "12.000 TRY" value below it rendered at the same size with zero contrast).
 * The value is `font-semibold` (was `font-medium`) so real money/date figures
 * carry a bit more presence without needing a whole separate "hero number"
 * treatment.
 */
function InfoGrid({
  items,
  compact = false,
  className,
}: {
  items: InfoGridItem[]
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3 text-sm",
        compact && "gap-2 p-2 text-xs",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <p className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.06em] uppercase">
            {item.label}
          </p>
          <p className="mt-0.5 truncate font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

export { InfoGrid }
export type { InfoGridItem }

import { AlertTriangle } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The "Kalan ödeme bulunmaktadır." / "Bu randevuya ait N. seans henüz
 * tamamlanmadı." single-line alert-plus-action strip — previously
 * reinvented in two places with two different radii. Extra `div` props
 * (`onClick`/`onKeyDown`) pass through so a caller nesting this inside its
 * own clickable `Card` can still `stopPropagation`. Sprint 20 — carries the
 * same `AlertTriangle` glyph the app's error boundaries use, so every
 * "this needs your attention" moment in the product reads as one family.
 */
function InlineWarningBanner({
  message,
  action,
  className,
  ...props
}: {
  message: ReactNode
  action?: ReactNode
} & Omit<ComponentProps<"div">, "children">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-2 text-warning">
        <AlertTriangle className="size-4 shrink-0" />
        {message}
      </span>
      {action}
    </div>
  )
}

export { InlineWarningBanner }

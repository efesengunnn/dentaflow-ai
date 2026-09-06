import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardTone = "primary" | "success" | "warning"

/**
 * Sprint 21 — Premium Visual Redesign: each KPI now carries a `tone` that
 * tints its icon badge and washes the card background very faintly in the
 * same hue, so the Dashboard's most important numbers each get a distinct
 * visual identity at a glance instead of four identical white boxes with a
 * small icon. This is the same "accent, not status" use of color `Card`'s
 * icon badge already had (see docs/DESIGN_SYSTEM.md) — `tone` doesn't imply
 * anything is wrong, it's just which accent this number reads best in
 * (money collected → success, money still owed → warning, everything else
 * → primary).
 */
const TONE_STYLES: Record<StatCardTone, { label: string; wash: string; ring: string; decor: string }> = {
  primary: {
    label: "text-primary",
    wash: "from-primary/[0.07]",
    ring: "hover:ring-primary/20",
    decor: "text-primary",
  },
  success: {
    label: "text-success",
    wash: "from-success/[0.07]",
    ring: "hover:ring-success/20",
    decor: "text-success",
  },
  warning: {
    label: "text-warning",
    wash: "from-warning/[0.08]",
    ring: "hover:ring-warning/20",
    decor: "text-warning",
  },
}

type StatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  tone?: StatCardTone
  /** Where this KPI's underlying records live — makes the card an actual navigation target. */
  href?: string
  /**
   * Opens something in place instead of navigating (Sprint 8.5's drill-down
   * Sheets) — mutually exclusive with `href` in practice, never both on the
   * same card.
   */
  onClick?: () => void
}

/**
 * Project Evolution V2 — the "icon-in-a-tinted-square, then a modestly
 * sized bold number" shape was the design audit's single most-cited
 * "generic admin panel" tell. Replaced with real weight contrast instead of
 * a chrome badge: the number is now genuinely huge and `font-light` in the
 * display serif (`font-display`, Fraunces — see `layout.tsx`), the label
 * drops to a small, heavy, letter-spaced caption doing the categorization
 * work an icon badge used to do. The icon survives only as the existing
 * large, near-invisible watermark (already zero-chrome) — never as a
 * filled badge. Hero number size/weight alone now carries "this is the
 * important number on the page," which a same-sized-as-everything-else
 * bold number never could.
 */
function StatCard({ label, value, icon: Icon, hint, href, onClick, tone = "primary" }: StatCardProps) {
  const toneStyle = TONE_STYLES[tone]

  const content = (
    <CardContent className="relative flex flex-col gap-2 px-6">
      <Icon
        className={cn(
          "pointer-events-none absolute -top-4 -right-4 size-28 rotate-12 opacity-[0.06] transition-transform duration-300 ease-standard group-hover:rotate-6 group-hover:scale-105",
          toneStyle.decor,
        )}
        aria-hidden="true"
      />
      <p className={cn("text-[11px] font-semibold tracking-[0.08em] uppercase", toneStyle.label)}>{label}</p>
      <p className="font-display text-6xl font-light tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground/70 text-xs">{hint}</p>}
    </CardContent>
  )

  const cardClassName = cn(
    "group gap-0 overflow-hidden bg-gradient-to-br to-card py-7 transition-shadow",
    toneStyle.wash,
    (href || onClick) && cn("hover:shadow-md", toneStyle.ring),
  )

  if (href) {
    return (
      <Link href={href} className="focus-visible:ring-ring/50 rounded-2xl focus-visible:ring-3">
        <Card className={cardClassName}>{content}</Card>
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus-visible:ring-ring/50 w-full rounded-2xl text-left focus-visible:ring-3"
      >
        <Card className={cardClassName}>{content}</Card>
      </button>
    )
  }

  return <Card className={cardClassName}>{content}</Card>
}

export { StatCard }

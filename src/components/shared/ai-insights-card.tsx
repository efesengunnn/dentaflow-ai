import { Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The "AI Insights" preview card shown on Lead/Patient Detail — a clearly
 * marked preview, not a fake working feature, per CLAUDE.md's AI Usage
 * Policy (never decorative, never overpromising what isn't built yet).
 *
 * Project Phoenix — AI is meant to be one of the product's signature
 * capabilities, so its icon badge gets a solid gradient fill
 * (`from-primary to-primary/70`) instead of the flat `bg-primary/10` tint
 * every other icon badge in the app uses — the one deliberate exception to
 * that convention, reserved for AI surfaces only, so it reads as a distinct
 * first-class category at a glance rather than one more muted icon chip.
 * The Dashboard's own AI teaser (inline in `dashboard/page.tsx`) reuses the
 * same gradient-badge treatment for one consistent "this is AI" signature
 * across the product. The `items` list variant (Sprint 6.5) was dropped —
 * the Dashboard moved to its own single-line teaser in Sprint 23, leaving
 * this prop with zero real callers.
 */
function AIInsightsCard({
  text = "AI Assistant bu bölümde gelecekte takip önerileri, risk analizi ve otomatik görev önerileri sunacaktır.",
}: {
  text?: string
}) {
  return (
    <Card className="border-primary/15 relative overflow-hidden bg-gradient-to-br from-primary/[0.07] via-card to-card">
      <div
        className="bg-primary/10 pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl"
        aria-hidden="true"
      />
      <CardContent className="relative flex items-start gap-3.5">
        <div className="from-primary to-primary/70 text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-xs">
          <Sparkles className="size-4.5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">AI Insights</span>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Yakında
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{text}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export { AIInsightsCard }

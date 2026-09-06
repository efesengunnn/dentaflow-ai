import { Sparkles } from "lucide-react"

import { FOLLOW_UP_RULES } from "@/lib/treatment-plans/constants"
import type { AIFollowUpCandidates } from "@/lib/treatment-plans/queries"

function buildAlertRows(candidates: AIFollowUpCandidates): string[] {
  const rows: string[] = []

  for (const rule of FOLLOW_UP_RULES) {
    const count = candidates.byRule[rule.key].length
    if (count > 0) rows.push(`${rule.label} kontrolü yaklaşan ${count} hasta`)
  }
  if (candidates.planEndingSoon.length > 0) {
    rows.push(`Tedavi planı bitmek üzere ${candidates.planEndingSoon.length} hasta`)
  }
  if (candidates.inactivePatients.length > 0) {
    rows.push(`30+ gündür gelmeyen ${candidates.inactivePatients.length} aktif hasta`)
  }

  return rows
}

/**
 * Sprint 27 — replaces the Sprint 24 static "AI Insights / Yakında" teaser
 * (which promised a different, unbuilt no-show-risk feature). Deterministic,
 * no LLM call: reuses `getFollowUpCandidatesForAI`, the same query behind the
 * chat panel's `getFollowUpCandidates` tool — a rule-based date/threshold
 * check doesn't need a model round trip (CLAUDE.md's AI Usage Policy). Pure
 * display, no controls, so it's a bare hairline section rather than `Card` —
 * matching "Son Aktiviteler"/"Yaklaşan Randevular" (Project Evolution V2's
 * "Card reserved for control surfaces" rule, docs/DESIGN_SYSTEM.md).
 * Sprint 28D — repointed to the new Treatment Plan model's
 * `getFollowUpCandidatesForAI`/`FOLLOW_UP_RULES` (`planEndingSoon`, not the
 * legacy `packageEndingSoon`); the legacy `treatment_series`-based version in
 * `lib/ai/queries.ts` is no longer this card's data source.
 */
function AIAlertsCard({ candidates }: { candidates: AIFollowUpCandidates }) {
  const rows = buildAlertRows(candidates)

  return (
    <div className="border-border flex flex-col gap-4 border-t pt-5">
      <div className="flex items-center gap-2">
        <div className="from-primary to-primary/70 text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-xs">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">AI Uyarıları</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Şu anda dikkat gerektiren bir durum yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row} className="flex items-center gap-2.5 text-sm">
              <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden="true" />
              {row}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { AIAlertsCard }

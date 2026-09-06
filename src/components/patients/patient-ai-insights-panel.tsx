import { differenceInCalendarDays, format } from "date-fns"
import { tr } from "date-fns/locale"
import { Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { FOLLOW_UP_RULES, INACTIVE_PATIENT_THRESHOLD_DAYS } from "@/lib/ai/constants"
import type { AIPatientSummary } from "@/lib/ai/queries"

function formatDate(isoDate: string): string {
  return format(new Date(isoDate), "d MMM yyyy", { locale: tr })
}

function addDays(isoDate: string, days: number): Date {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + days)
  return date
}

/** Doctor-entered `control_date` wins when set; otherwise a computed estimate from the matched follow-up rule. */
function resolveSuggestedControlDate(summary: AIPatientSummary): { date: Date; isEstimate: boolean } | null {
  if (summary.nextControlDate) return { date: new Date(summary.nextControlDate), isEstimate: false }
  if (!summary.lastSessionDate || !summary.lastSessionType) return null

  const typeLower = summary.lastSessionType.toLocaleLowerCase("tr")
  const matchedRule = FOLLOW_UP_RULES.find((rule) => rule.keywords.some((keyword) => typeLower.includes(keyword)))
  if (!matchedRule) return null

  return { date: addDays(summary.lastSessionDate, matchedRule.intervalDays), isEstimate: true }
}

function deriveAttentionNote(summary: AIPatientSummary): string | null {
  if (!summary.lastSessionDate) return null

  const daysSinceLastSession = differenceInCalendarDays(new Date(), new Date(summary.lastSessionDate))
  if (daysSinceLastSession >= INACTIVE_PATIENT_THRESHOLD_DAYS) {
    return `${daysSinceLastSession} gündür klinik ziyareti yok.`
  }

  const suggested = resolveSuggestedControlDate(summary)
  if (suggested && suggested.date <= new Date()) {
    return "Kontrol zamanı geldi."
  }

  return null
}

/**
 * Sprint 27 — Patient Detail's real AI box, replacing the "Yakında" teaser
 * (`AIInsightsCard` stays as-is on Lead Detail, out of scope here). "Pakette
 * kalan hak" is a session count, not a ₺ figure — this surface needs no
 * `financial_access` gating at all, since Tier-1 per-patient data is already
 * visible to every role (docs/ARCHITECTURE.md).
 */
function PatientAIInsightsPanel({ summary }: { summary: AIPatientSummary | null }) {
  const hasHistory = summary?.lastSessionDate != null

  const suggestedControl = summary && hasHistory ? resolveSuggestedControlDate(summary) : null
  const attentionNote = summary && hasHistory ? deriveAttentionNote(summary) : null

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
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm font-semibold">AI Özet</span>

          {!summary || !hasHistory ? (
            <p className="text-muted-foreground text-sm">Henüz bir işlem geçmişi yok.</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Son işlem</dt>
              <dd>
                {summary.lastSessionType} · {formatDate(summary.lastSessionDate!)}
              </dd>
              {suggestedControl && (
                <>
                  <dt className="text-muted-foreground">Önerilen kontrol</dt>
                  <dd>
                    {format(suggestedControl.date, "d MMM yyyy", { locale: tr })}
                    {suggestedControl.isEstimate && <span className="text-muted-foreground"> (tahmini)</span>}
                  </dd>
                </>
              )}
              {summary.totalRemainingSessions > 0 && (
                <>
                  <dt className="text-muted-foreground">Pakette kalan hak</dt>
                  <dd>{summary.totalRemainingSessions} seans</dd>
                </>
              )}
            </dl>
          )}

          {attentionNote && <p className="text-warning text-sm font-medium">{attentionNote}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export { PatientAIInsightsPanel }

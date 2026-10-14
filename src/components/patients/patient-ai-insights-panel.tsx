import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { describePendingTreatment, type PatientTreatmentSummary } from "@/lib/ai/summary"
import { formatToothList } from "@/lib/odontogram/fdi"

function formatDate(isoDate: string): string {
  return format(new Date(`${isoDate.slice(0, 10)}T00:00:00`), "d MMM yyyy", { locale: tr })
}

/**
 * Patient Detail's "AI Özet" box — rule-based, no LLM call (CLAUDE.md AI
 * Usage Policy). 2026-10-14: reads the dental treatment picture from
 * `summarizePatientTreatments` (treatment plans, teeth, follow-up rules) —
 * the same summary the chat assistant's `getPatientSummary` tool returns.
 * No money on this surface, so no `financial_access` gating.
 */
function PatientAIInsightsPanel({ summary }: { summary: PatientTreatmentSummary }) {
  const hasAnything = summary.lastTreatment !== null || summary.pendingTreatments.length > 0

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

          {!hasAnything ? (
            <p className="text-muted-foreground text-sm">Henüz bir tedavi kaydı yok.</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {summary.lastTreatment && (
                <>
                  <dt className="text-muted-foreground">Son tedavi</dt>
                  <dd>
                    {summary.lastTreatment.treatmentName}
                    {summary.lastTreatment.toothNumbers.length > 0 &&
                      ` (Diş ${formatToothList(summary.lastTreatment.toothNumbers)})`}{" "}
                    · {formatDate(summary.lastTreatment.date)}
                  </dd>
                </>
              )}
              {summary.pendingTreatments.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Bekleyen</dt>
                  <dd>{summary.pendingTreatments.map(describePendingTreatment).join(", ")}</dd>
                </>
              )}
              {summary.suggestedControl && (
                <>
                  <dt className="text-muted-foreground">Önerilen kontrol</dt>
                  <dd>
                    {formatDate(summary.suggestedControl.dueDate)} · {summary.suggestedControl.treatmentName}
                    {summary.suggestedControl.isEstimate && <span className="text-muted-foreground"> (tahmini)</span>}
                  </dd>
                </>
              )}
            </dl>
          )}

          {summary.attentionNotes.map((note) => (
            <p key={note} className="text-warning text-sm font-medium">
              {note}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { PatientAIInsightsPanel }

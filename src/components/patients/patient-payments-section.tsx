import { Wallet } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/format/currency"
import { TREATMENT_PAYMENT_METHOD_LABELS } from "@/lib/treatment-plans/constants"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { cn } from "@/lib/utils"

type CurrencyRollup = { currency: string; debt: number; paid: number; remaining: number }

/** TRY first, then others alphabetically — same order as the ledger. */
function rollupByCurrency(plans: TreatmentPlanDetail[]): CurrencyRollup[] {
  const byCurrency = new Map<string, CurrencyRollup>()
  for (const plan of plans) {
    for (const entry of plan.currencyTotals) {
      const roll = byCurrency.get(entry.currency) ?? { currency: entry.currency, debt: 0, paid: 0, remaining: 0 }
      roll.debt += entry.total ?? 0
      roll.paid += entry.paid
      roll.remaining += entry.remaining ?? 0
      byCurrency.set(entry.currency, roll)
    }
  }
  return Array.from(byCurrency.values()).sort((a, b) =>
    a.currency === "TRY" ? -1 : b.currency === "TRY" ? 1 : a.currency.localeCompare(b.currency),
  )
}

/**
 * "Ödemeler" — Sprint 29. Deliberately minimal (founder decision): three
 * totals + last 5 payment movements, no full ledger. Sourced from
 * `treatmentPlans` (the new system) only — mirrors the same
 * "voided plans don't count toward totals" rule `PatientDetailView`'s top
 * stat strip already applies to the legacy `treatmentSeries` totals.
 *
 * Sprint 31 — totals are rolled up per currency (a patient may have both TRY
 * and EUR treatments); TRY and EUR are never summed together.
 */
function PatientPaymentsSection({ treatmentPlans }: { treatmentPlans: TreatmentPlanDetail[] }) {
  const visiblePlans = treatmentPlans.filter((plan) => plan.status !== "voided")
  const rollups = rollupByCurrency(visiblePlans)
  const displayRollups = rollups.length > 0 ? rollups : [{ currency: "TRY", debt: 0, paid: 0, remaining: 0 }]

  const recentPayments = visiblePlans
    .flatMap((plan) => plan.payments)
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {displayRollups.map((roll) => (
          <div key={roll.currency} className="grid grid-cols-3 gap-4 rounded-2xl border bg-muted/20 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Toplam Borç</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(roll.debt, roll.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ödenen</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(roll.paid, roll.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kalan</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", roll.remaining > 0 && "text-warning")}>
                {formatCurrency(roll.remaining, roll.currency)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {recentPayments.length === 0 ? (
        <EmptyState compact icon={Wallet} title="Henüz ödeme kaydı yok" />
      ) : (
        <div className="flex flex-col gap-2">
          {recentPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium tabular-nums">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
                <span className="text-muted-foreground">{TREATMENT_PAYMENT_METHOD_LABELS[payment.method]}</span>
                {payment.entryType !== "payment" && (
                  <Badge variant={payment.entryType === "refund" ? "warning" : "destructive"}>
                    {payment.entryType === "refund" ? "İade" : payment.entryType === "void" ? "İptal" : "Düzeltme"}
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(payment.paidAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { PatientPaymentsSection }

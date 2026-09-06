import { Wallet } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { TREATMENT_PAYMENT_METHOD_LABELS } from "@/lib/treatment-plans/constants"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { cn } from "@/lib/utils"

/**
 * "Ödemeler" — Sprint 29. Deliberately minimal (founder decision): three
 * totals + last 5 payment movements, no full ledger. Sourced from
 * `treatmentPlans` (the new system) only — mirrors the same
 * "voided plans don't count toward totals" rule `PatientDetailView`'s top
 * stat strip already applies to the legacy `treatmentSeries` totals.
 */
function PatientPaymentsSection({ treatmentPlans }: { treatmentPlans: TreatmentPlanDetail[] }) {
  const visiblePlans = treatmentPlans.filter((plan) => plan.status !== "voided")
  const totalDebt = visiblePlans.reduce((sum, plan) => sum + (plan.totalAmount ?? 0), 0)
  const totalPaid = visiblePlans.reduce((sum, plan) => sum + plan.paidAmount, 0)
  const totalRemaining = visiblePlans.reduce((sum, plan) => sum + (plan.remainingBalance ?? 0), 0)
  const currency = visiblePlans[0]?.currency ?? "TRY"

  const recentPayments = visiblePlans
    .flatMap((plan) => plan.payments)
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4 rounded-2xl border bg-muted/20 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Toplam Borç</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {totalDebt.toLocaleString("tr-TR")} {currency}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ödenen</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {totalPaid.toLocaleString("tr-TR")} {currency}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Kalan</p>
          <p className={cn("mt-1 text-lg font-semibold tabular-nums", totalRemaining > 0 && "text-warning")}>
            {totalRemaining.toLocaleString("tr-TR")} {currency}
          </p>
        </div>
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
                  {payment.amount.toLocaleString("tr-TR")} {payment.currency}
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

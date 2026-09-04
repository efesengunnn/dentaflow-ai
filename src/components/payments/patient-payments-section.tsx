import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Wallet } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import type { PatientBalance, PatientPaymentRow } from "@/lib/payments/queries"
import { AddPaymentSheet } from "./add-payment-sheet"

type PatientPaymentsSectionProps = {
  patientId: string
  balance: PatientBalance
  payments: PatientPaymentRow[]
  canManagePayments: boolean
}

function PatientPaymentsSection({ patientId, balance, payments, canManagePayments }: PatientPaymentsSectionProps) {
  const hasBalanceDue = balance.remainingBalance > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <div
          className={cn(
            "flex flex-col justify-center rounded-2xl border p-6 sm:min-w-64",
            hasBalanceDue ? "border-warning/25 bg-warning/5" : "border-border bg-muted/20",
          )}
        >
          <p className={cn("text-[11px] font-semibold tracking-[0.08em] uppercase", hasBalanceDue ? "text-warning" : "text-muted-foreground")}>
            Kalan Bakiye
          </p>
          <p className={cn("mt-1 text-4xl font-light tracking-tight tabular-nums", hasBalanceDue && "text-warning")}>
            {balance.remainingBalance.toLocaleString("tr-TR")} TRY
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Toplam Borç: {balance.totalCharged.toLocaleString("tr-TR")} TRY · Toplam Tahsilat:{" "}
            {balance.totalPaid.toLocaleString("tr-TR")} TRY
          </p>
        </div>
      </div>

      {canManagePayments && (
        <div>
          <AddPaymentSheet patientId={patientId} />
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState icon={Wallet} title="Henüz ödeme yok" description="Bu hasta için ilk tahsilatı kaydedin." />
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{payment.amount.toLocaleString("tr-TR")} TRY</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(`${payment.paidAt}T00:00:00`), "d MMMM yyyy", { locale: tr })}
                  {payment.method ? ` · ${payment.method}` : ""}
                </p>
                {payment.note && <p className="text-sm text-muted-foreground">{payment.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { PatientPaymentsSection }

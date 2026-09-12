"use client"

import { Wallet } from "lucide-react"
import { useRouter } from "next/navigation"

import { AddTreatmentPlanPaymentSheet } from "@/components/treatment-plans/add-treatment-plan-payment-sheet"
import type { CurrencyBalance } from "@/components/treatment-plans/treatment-plan-payment-form"
import { Button } from "@/components/ui/button"

/**
 * Sprint 31 (founder bug report 2026-09-11) — the appointment detail panel's
 * "Tahsilat Yap" quick action for the new treatment-plan model. A thin client
 * wrapper only because `recordTreatmentPlanPayment` revalidates `/patients/[id]`
 * (not this appointment route), so the panel needs an explicit `router.refresh()`
 * on success to reflect the new paid/remaining figures — same pattern the
 * agenda list already uses for the legacy `AddPaymentSheet`.
 */
function AppointmentPlanPaymentButton({
  treatmentPlanId,
  currencyBalances,
}: {
  treatmentPlanId: string
  currencyBalances: CurrencyBalance[]
}) {
  const router = useRouter()

  return (
    <AddTreatmentPlanPaymentSheet
      treatmentPlanId={treatmentPlanId}
      currencyBalances={currencyBalances}
      onSuccess={() => router.refresh()}
      trigger={
        <Button size="sm" variant="outline">
          <Wallet />
          Tahsilat Yap
        </Button>
      }
    />
  )
}

export { AppointmentPlanPaymentButton }

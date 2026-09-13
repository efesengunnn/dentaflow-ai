"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { TreatmentPlanPaymentForm, type CurrencyBalance } from "@/components/treatment-plans/treatment-plan-payment-form"
import { formatCurrency } from "@/lib/format/currency"

type PayablePlan = {
  id: string
  planName: string
  /** Sprint 31 — per-currency remaining balance; a plan may owe in more than one. */
  currencyBalances: CurrencyBalance[]
}

function formatRemaining(balances: CurrencyBalance[]): string {
  const withBalance = balances.filter((b) => b.remaining !== null && b.remaining > 0)
  if (withBalance.length === 0) {
    return balances.some((b) => b.remaining === null) ? "Belirlenmedi" : formatCurrency(0, balances[0]?.currency ?? "TRY")
  }
  return withBalance.map((b) => formatCurrency(b.remaining ?? 0, b.currency)).join(" + ")
}

/**
 * Hasta Kartı'nın "Ödemeler" bölümündeki "Ödeme Ekle" aksiyonu — Sprint 29.
 * `patient-payment-sheet.tsx`'in (eski Tedaviler/paket sistemi) yeni Tedavi
 * Planı sistemi için birebir eşdeğeri, aynı "0/1/2+ plan" davranışı: tek
 * ödenecek plan varsa doğrudan form açılır, birden fazlaysa önce plan seçimi
 * istenir.
 */
function PatientPlanPaymentSheet({ planOptions }: { planOptions: PayablePlan[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const selectedPlan =
    planOptions.find((plan) => plan.id === selectedPlanId) ?? (planOptions.length === 1 ? planOptions[0] : undefined)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setSelectedPlanId(null)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm" disabled={planOptions.length === 0}>
          <Plus />
          Ödeme Ekle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ödeme Ekle</SheetTitle>
          <SheetDescription>
            {selectedPlan
              ? `${selectedPlan.planName} için ödeme kaydedin.`
              : "Ödeme hangi tedavi planı için yapılacak?"}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          {!selectedPlan ? (
            <div className="flex flex-col gap-2">
              {planOptions.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className="flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">{plan.planName}</span>
                  <span className="text-muted-foreground">Kalan: {formatRemaining(plan.currencyBalances)}</span>
                </button>
              ))}
            </div>
          ) : (
            <TreatmentPlanPaymentForm
              treatmentPlanId={selectedPlan.id}
              currencyBalances={selectedPlan.currencyBalances}
              onSuccess={() => {
                handleOpenChange(false)
                router.refresh()
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { PatientPlanPaymentSheet }

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
import { TreatmentPlanPaymentForm } from "@/components/treatment-plans/treatment-plan-payment-form"

type PayablePlan = {
  id: string
  planName: string
  remainingBalance: number | null
  currency: string
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
        <Button size="sm" variant="outline" disabled={planOptions.length === 0}>
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
                  <span className="text-muted-foreground">
                    Kalan:{" "}
                    {plan.remainingBalance === null
                      ? "Belirlenmedi"
                      : `${plan.remainingBalance.toLocaleString("tr-TR")} ${plan.currency}`}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <TreatmentPlanPaymentForm
              treatmentPlanId={selectedPlan.id}
              remainingBalance={selectedPlan.remainingBalance}
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

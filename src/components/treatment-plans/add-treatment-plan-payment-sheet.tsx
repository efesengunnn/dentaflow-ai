"use client"

import { Plus } from "lucide-react"
import type { ReactNode } from "react"
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
import { TreatmentPlanPaymentForm } from "./treatment-plan-payment-form"

function AddTreatmentPlanPaymentSheet({
  treatmentPlanId,
  remainingBalance,
  onSuccess,
  trigger,
}: {
  treatmentPlanId: string
  remainingBalance: number | null
  onSuccess?: () => void
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus />
            Ödeme Ekle
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ödeme Ekle</SheetTitle>
          <SheetDescription>Bu tedavi planına yeni bir ödeme kaydedin.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <TreatmentPlanPaymentForm
            treatmentPlanId={treatmentPlanId}
            remainingBalance={remainingBalance}
            onSuccess={() => {
              setOpen(false)
              onSuccess?.()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { AddTreatmentPlanPaymentSheet }

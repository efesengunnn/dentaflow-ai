"use client"

import { Undo2 } from "lucide-react"
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
import type { TreatmentPlanPaymentRow } from "@/lib/treatment-plans/queries"
import { TreatmentPlanPaymentCorrectionForm } from "./treatment-plan-payment-correction-form"

function TreatmentPlanPaymentCorrectionSheet({
  treatmentPlanId,
  payment,
  onSuccess,
}: {
  treatmentPlanId: string
  payment: TreatmentPlanPaymentRow
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="İade / Düzelt">
          <Undo2 />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>İade / Düzeltme</SheetTitle>
          <SheetDescription>
            Bu ödeme düzenlenmez ya da silinmez — düzeltme yeni bir kayıt olarak eklenir.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <TreatmentPlanPaymentCorrectionForm
            treatmentPlanId={treatmentPlanId}
            payment={payment}
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

export { TreatmentPlanPaymentCorrectionSheet }

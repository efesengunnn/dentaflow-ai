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
import type { TreatmentPaymentRow } from "@/lib/treatments/queries"
import { PaymentCorrectionForm } from "./payment-correction-form"

function PaymentCorrectionSheet({
  seriesId,
  payment,
  onSuccess,
}: {
  seriesId: string
  payment: TreatmentPaymentRow
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
          <PaymentCorrectionForm
            seriesId={seriesId}
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

export { PaymentCorrectionSheet }

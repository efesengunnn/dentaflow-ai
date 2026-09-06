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
import { PaymentForm } from "./payment-form"

function AddPaymentSheet({
  seriesId,
  remainingBalance,
  onSuccess,
  trigger,
  title = "Ödeme Ekle",
  description = "Bu pakete yeni bir ödeme kaydedin.",
}: {
  seriesId: string
  remainingBalance: number | null
  onSuccess?: () => void
  /** Overrides the default "+ Ödeme Ekle" button — the package card's "Tahsilat Yap" callout (Sprint 16) reuses this exact Sheet + `PaymentForm` wiring with different trigger copy, not a second payment screen. */
  trigger?: ReactNode
  title?: string
  description?: string
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
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <PaymentForm
            seriesId={seriesId}
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

export { AddPaymentSheet }

"use client"

import { CheckCircle2 } from "lucide-react"
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
import type { AssignableStaff } from "@/lib/staff/queries"
import { CompleteSessionForm } from "./complete-session-form"

function CompleteSessionSheet({
  treatmentPlanItemId,
  treatmentName,
  appointmentId,
  nextSessionNumber,
  staffOptions,
  defaultStaffId,
  onSuccess,
  trigger,
}: {
  treatmentPlanItemId: string
  treatmentName: string
  appointmentId?: string
  nextSessionNumber: number
  staffOptions: AssignableStaff[]
  defaultStaffId: string
  onSuccess?: () => void
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="success">
            <CheckCircle2 />
            Seansı Tamamla
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Seansı Tamamla</SheetTitle>
          <SheetDescription>{treatmentName} — {nextSessionNumber}. seans.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <CompleteSessionForm
            treatmentPlanItemId={treatmentPlanItemId}
            appointmentId={appointmentId}
            nextSessionNumber={nextSessionNumber}
            staffOptions={staffOptions}
            defaultStaffId={defaultStaffId}
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

export { CompleteSessionSheet }

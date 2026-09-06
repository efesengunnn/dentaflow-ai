"use client"

import { PenLine } from "lucide-react"
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
import type { TreatmentSessionRow } from "@/lib/treatment-plans/queries"
import { SessionCorrectionForm } from "./session-correction-form"

function SessionCorrectionSheet({
  session,
  staffOptions,
  onSuccess,
}: {
  session: TreatmentSessionRow
  staffOptions: AssignableStaff[]
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label="Seansı Düzelt">
          <PenLine />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{session.sessionNumber}. Seansı Düzelt</SheetTitle>
          <SheetDescription>
            Bu seans düzenlenmez — orijinal kayıt &ldquo;düzeltildi&rdquo; olarak işaretlenir, yeni bilgilerle bir yenisi eklenir.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <SessionCorrectionForm
            session={session}
            staffOptions={staffOptions}
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

export { SessionCorrectionSheet }

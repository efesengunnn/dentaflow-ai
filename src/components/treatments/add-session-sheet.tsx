"use client"

import { Pencil } from "lucide-react"
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
import { SessionForm } from "./session-form"

/**
 * Sprint 12: relabeled from "Seans Ekle" to "Detaylı Ekle" — the checklist
 * in `TreatmentSeriesDetailSheet` now handles the common case (mark today's
 * next session done) in one click, with zero fields. This Sheet is what's
 * left for the real remaining need: a custom session number, staff, date,
 * or a deliberately "Planlandı" (not-yet-done) future session — a distinct,
 * secondary action, not the same button doing the same job twice.
 */
function AddSessionSheet({
  seriesId,
  suggestedSessionNumber,
  staffOptions,
  onSuccess,
}: {
  seriesId: string
  suggestedSessionNumber: number
  staffOptions: AssignableStaff[]
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil />
          Detaylı Ekle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Seansı Detaylı Ekle</SheetTitle>
          <SheetDescription>
            Özel bir tarih, personel veya durumla seans kaydedin. Bugünkü sıradaki seansı tek
            tıkla tamamlamak için &ldquo;Tamamlandı&rdquo; butonunu kullanın.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <SessionForm
            seriesId={seriesId}
            suggestedSessionNumber={suggestedSessionNumber}
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

export { AddSessionSheet }

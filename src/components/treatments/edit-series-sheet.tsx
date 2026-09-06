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
import { EditSeriesForm } from "./edit-series-form"

function EditSeriesSheet({
  seriesId,
  treatmentType,
  totalSessions,
  totalFee,
  onSuccess,
}: {
  seriesId: string
  treatmentType: string
  totalSessions: number
  totalFee: number | null
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Paketi düzenle">
          <Pencil />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Paketi Düzenle</SheetTitle>
          <SheetDescription>Değişiklikler aktivite geçmişine kaydedilir.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <EditSeriesForm
            seriesId={seriesId}
            treatmentType={treatmentType}
            totalSessions={totalSessions}
            totalFee={totalFee}
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

export { EditSeriesSheet }

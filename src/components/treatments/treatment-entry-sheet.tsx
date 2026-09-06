"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
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
import { TreatmentEntryForm } from "./treatment-entry-form"

function TreatmentEntrySheet({
  patientId,
  staffOptions,
  defaultAppointmentId,
  defaultStaffId,
  defaultTreatmentDate,
  trigger,
}: {
  patientId: string
  staffOptions: AssignableStaff[]
  defaultAppointmentId?: string
  defaultStaffId?: string
  defaultTreatmentDate?: string
  /** Overrides the default "+ Tedavi Ekle" button — Hasta Kartı's "Hızlı İşlemler" (Sprint 17) reuses this exact Sheet with "Tedavi Başlat" copy, not a second entry point. */
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus />
            Tedavi Ekle
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tedavi Ekle</SheetTitle>
          <SheetDescription>Tek seferlik bir işlem ya da çok seanslı bir paket kaydedin.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <TreatmentEntryForm
            patientId={patientId}
            staffOptions={staffOptions}
            defaultAppointmentId={defaultAppointmentId}
            defaultStaffId={defaultStaffId}
            defaultTreatmentDate={defaultTreatmentDate}
            onSuccess={() => {
              setOpen(false)
              router.refresh()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { TreatmentEntrySheet }

"use client"

import { Pencil } from "lucide-react"
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
import { updatePatient } from "@/lib/patients/actions"
import type { PatientDetail } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { PatientForm } from "./patient-form"

function PatientEditSheet({
  patient,
  staffOptions,
  trigger,
}: {
  patient: PatientDetail
  staffOptions: AssignableStaff[]
  /** Overrides the default "Düzenle" button — Hasta Kartı's "Hızlı İşlemler" (Sprint 17) reuses this exact Sheet with "Hastayı Düzenle" copy, not a second edit screen. */
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Pencil />
            Düzenle
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Hastayı Düzenle</SheetTitle>
          <SheetDescription>
            Bilgileri güncelleyin. Değişiklikler aktivite geçmişine kaydedilir.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <PatientForm
            mode="edit"
            defaultValues={{
              fullName: patient.fullName,
              phone: patient.phone,
              email: patient.email ?? "",
              tcKimlikNo: patient.tcKimlikNo ?? "",
              dateOfBirth: patient.dateOfBirth ?? "",
              note: "",
            }}
            staffOptions={staffOptions}
            onSubmit={(values) => updatePatient(patient.id, values)}
            onSuccess={() => setOpen(false)}
            submitLabel="Kaydet"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { PatientEditSheet }

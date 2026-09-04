"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PatientForm } from "@/components/patients/patient-form"
import { createPatientQuick } from "@/lib/patients/actions"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"

type QuickAddPatientSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (patient: PatientOption) => void
  staffOptions: AssignableStaff[]
}

/**
 * "+ Yeni Hasta" (Sprint 14) — opened from the appointment form's "Hasta"
 * Combobox when the patient doesn't exist yet. Reuses `PatientForm` as-is
 * (`hideAppointmentOption` — creating an appointment is already why this
 * Sheet is open) and `createPatientQuick` (no redirect, returns the created
 * patient so the appointment form can select it without a page reload).
 */
function QuickAddPatientSheet({ open, onOpenChange, onCreated, staffOptions }: QuickAddPatientSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Yeni Hasta</SheetTitle>
          <SheetDescription>Hastayı oluşturun, randevu formuna otomatik seçili olarak dönecek.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <PatientForm
            mode="create"
            hideAppointmentOption
            staffOptions={staffOptions}
            onSubmit={createPatientQuick}
            onSuccess={(state) => {
              if (state.patient) onCreated(state.patient)
            }}
            submitLabel="Hasta Oluştur"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { QuickAddPatientSheet }

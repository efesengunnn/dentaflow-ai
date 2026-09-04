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
import { updateAppointment } from "@/lib/appointments/actions"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { localDateToDateString } from "@/lib/format/date"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { AppointmentForm } from "./appointment-form"

/**
 * Narrower than `AppointmentDetail`/`AppointmentListRow` — only the fields
 * this Sheet actually reads, so either shape (the appointment detail page's
 * full row, or the agenda list's lighter row) can be passed in directly.
 */
type EditableAppointment = {
  id: string
  patientId: string
  staffId: string
  startsAt: string
  status: AppointmentStatus
  reason: string | null
}

function AppointmentEditSheet({
  appointment,
  patientOptions,
  staffOptions,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  appointment: EditableAppointment
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
  /** Overrides the default "Düzenle" button — the appointment detail page's "Hızlı İşlemler" card reuses this exact Sheet with its own trigger. Ignored when `open` is provided (see below). */
  trigger?: ReactNode
  /**
   * External control, for `AppointmentAgendaList`'s row menu: a
   * `SheetTrigger` nested inside a `DropdownMenuItem` is a known-fragile
   * Radix composition (the menu unmounting can race the Sheet opening), so
   * the agenda list instead lifts an `editTarget` row into its own state
   * and renders this Sheet once, externally controlled, exactly like it
   * already does for the cancel/delete `AlertDialog`s. Omit both for the
   * default self-managed (uncontrolled) open state.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen

  const startsAtDate = new Date(appointment.startsAt)
  const time = `${String(startsAtDate.getHours()).padStart(2, "0")}:${String(startsAtDate.getMinutes()).padStart(2, "0")}`

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger asChild>
          {trigger ?? (
            <Button variant="outline">
              <Pencil />
              Düzenle
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Randevuyu Düzenle</SheetTitle>
          <SheetDescription>
            Bilgileri güncelleyin. Değişiklikler aktivite geçmişine kaydedilir.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <AppointmentForm
            mode="edit"
            defaultValues={{
              patientId: appointment.patientId,
              staffId: appointment.staffId,
              date: localDateToDateString(startsAtDate),
              time,
              status: appointment.status,
              reason: appointment.reason ?? "",
              note: "",
            }}
            patientOptions={patientOptions}
            staffOptions={staffOptions}
            onSubmit={(values) => updateAppointment(appointment.id, values)}
            onSuccess={() => setOpen(false)}
            submitLabel="Kaydet"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { AppointmentEditSheet }

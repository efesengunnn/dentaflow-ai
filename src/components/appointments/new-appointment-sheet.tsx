"use client"

import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { insertAppointment, type AppointmentActionState } from "@/lib/appointments/actions"
import type { AppointmentFormValues } from "@/lib/appointments/schema"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { AppointmentForm } from "./appointment-form"

type NewAppointmentSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  defaultDate?: string
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
}

/**
 * Controlled (no own `SheetTrigger`) — opened by clicking an empty day in
 * the calendar (Sprint 11), same "Sheet wraps the existing form, no new
 * create surface" pattern as `AppointmentEditSheet`. `defaultDate` is the
 * clicked day: "Tarih" arrives pre-filled so the only fields left to enter
 * are Hasta/Saat/Sağlayıcı, per the founder's explicit requirement — Süre
 * and Durum already default sensibly (`appointmentFormDefaults`), so nothing
 * needs to be hidden from the shared `AppointmentForm` to achieve that.
 *
 * Uses `insertAppointment` (Sprint 8's non-redirecting sibling of
 * `createAppointment`), not `createAppointment` itself — the latter
 * `redirect()`s to the new appointment's detail page on success, which would
 * navigate away from the calendar entirely and defeat the point of a Sheet.
 * `onCreated` (owned by `AppointmentCalendar`, which already knows the
 * clicked day/mode/anchor) decides how to refresh — selecting the new
 * appointment's day so the agenda list below shows it immediately, not just
 * the calendar grid.
 */
function NewAppointmentSheet({
  open,
  onOpenChange,
  onCreated,
  defaultDate,
  patientOptions,
  staffOptions,
}: NewAppointmentSheetProps) {
  async function handleSubmit(values: AppointmentFormValues): Promise<AppointmentActionState> {
    const result = await insertAppointment(values)
    if ("error" in result) return result
    if (result.treatmentWarning) toast.error(result.treatmentWarning)
    return { success: true }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Yeni Randevu</SheetTitle>
          <SheetDescription>
            {defaultDate
              ? `${new Date(defaultDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} için yeni bir randevu oluşturun.`
              : "Yeni bir randevu oluşturun."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <AppointmentForm
            mode="create"
            defaultValues={defaultDate ? { date: defaultDate } : undefined}
            patientOptions={patientOptions}
            staffOptions={staffOptions}
            onSubmit={handleSubmit}
            onSuccess={onCreated}
            submitLabel="Oluştur"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { NewAppointmentSheet }

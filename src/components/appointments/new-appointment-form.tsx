"use client"

import { createAppointment } from "@/lib/appointments/actions"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { AppointmentForm } from "./appointment-form"

function NewAppointmentForm({
  patientOptions,
  staffOptions,
  defaultPatientId,
  defaultDate,
}: {
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
  defaultPatientId?: string
  /** Pre-fills "Tarih" — the calendar's "click an empty day" flow (Sprint 11) so the user never re-picks a date they already chose by clicking it. */
  defaultDate?: string
}) {
  const defaultValues =
    defaultPatientId || defaultDate ? { patientId: defaultPatientId, date: defaultDate } : undefined

  return (
    <AppointmentForm
      mode="create"
      defaultValues={defaultValues}
      patientOptions={patientOptions}
      staffOptions={staffOptions}
      onSubmit={createAppointment}
      submitLabel="Oluştur"
    />
  )
}

export { NewAppointmentForm }

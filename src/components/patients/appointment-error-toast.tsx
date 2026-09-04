"use client"

import { useEffect } from "react"
import { toast } from "sonner"

/**
 * Fires once on mount if `createPatient`'s "Aynı anda randevu oluştur"
 * checkbox created the patient but the appointment insert failed (a staff
 * double-booking conflict, most likely) — the patient record is already
 * safely saved either way, so this surfaces the one thing that didn't
 * happen rather than silently dropping it. See `insertAppointment` in
 * `lib/appointments/actions.ts`.
 */
function AppointmentErrorToast({ message }: { message?: string }) {
  useEffect(() => {
    if (message) toast.error(message)
  }, [message])

  return null
}

export { AppointmentErrorToast }

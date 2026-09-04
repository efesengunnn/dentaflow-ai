import { z } from "zod"

import type { AppointmentStatus } from "@/lib/appointments/constants"
import { localDateToDateString } from "@/lib/format/date"

const APPOINTMENT_STATUS_VALUES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const

export const appointmentFormSchema = z.object({
  patientId: z.string().min(1, "Hasta seçin."),
  staffId: z.string().min(1, "Sağlayıcı seçin."),
  date: z.string().min(1, "Tarih seçin."),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Geçerli bir saat seçin."),
  status: z.enum(APPOINTMENT_STATUS_VALUES, { message: "Durum seçin." }),
  reason: z.string().trim().max(200, "Sebep 200 karakteri geçemez.").optional(),
  note: z.string().trim().max(2000, "Not 2000 karakteri geçemez.").optional(),
  /** Already-defined, unlinked planned tooth treatments to attach to this appointment — see "Bağlı Tedaviler". */
  treatmentIds: z.array(z.string()).optional(),
})

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>

export const appointmentFormDefaults: AppointmentFormValues = {
  patientId: "",
  staffId: "",
  date: "",
  time: "",
  status: "scheduled",
  reason: "",
  note: "",
  treatmentIds: [],
}

/**
 * Reconstructs a full `updateAppointment` payload from a list row's existing
 * fields, changing only `status` — reused as-is for one-click quick actions
 * (dashboard "Geldi"/"Tamamlandı", agenda list "İptal Et") instead of a
 * separate "status-only" Server Action.
 */
export function appointmentStatusUpdatePayload(
  row: { patientId: string; staffId: string; startsAt: string; reason: string | null },
  status: AppointmentStatus,
): AppointmentFormValues {
  const startsAtDate = new Date(row.startsAt)
  const time = `${String(startsAtDate.getHours()).padStart(2, "0")}:${String(startsAtDate.getMinutes()).padStart(2, "0")}`

  return {
    ...appointmentFormDefaults,
    patientId: row.patientId,
    staffId: row.staffId,
    date: localDateToDateString(startsAtDate),
    time,
    status,
    reason: row.reason ?? "",
  }
}

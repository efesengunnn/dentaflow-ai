import { z } from "zod"

import type { AppointmentStatus } from "@/lib/appointments/constants"
import { SUPPORTED_CURRENCIES } from "@/lib/format/currency"
import { localDateToDateString } from "@/lib/format/date"

const APPOINTMENT_STATUS_VALUES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const

/**
 * Sprint 30 — Provider-Based Treatment Flow: `staffId` is no longer a
 * user-picked form field (the appointment form dropped its top-level
 * "Sağlayıcı" question); it's set programmatically from whichever provider
 * the chosen `treatmentPlanItemId` belongs to, or from the "Tek Seans / Tek
 * İşlem" branch's own provider step. Still required at the schema level as a
 * safety net — the DB column is NOT NULL either way.
 *
 * Sprint 30.3 — Simplified Appointment Flow: two mutually exclusive treatment
 * shapes now exist, never mixed. "Tanımlanmış Paket" sets
 * `treatmentPlanId`/`treatmentPlanItemId` (both together). "Tek Seans / Tek
 * İşlem" sets `standaloneTreatmentName`/`standalonePrice`/`controlDate`
 * instead — no `treatment_plan_item` is ever created for it (founder
 * decision: package sales and single ad-hoc sessions stay separate flows).
 * A plain "no treatment at all" appointment leaves every treatment field
 * empty — still valid, no separate mode enum. See
 * `appointment-treatment-section.tsx`.
 */
export const appointmentFormSchema = z
  .object({
    patientId: z.string().min(1, "Hasta seçin."),
    staffId: z.string().min(1, "Sağlayıcı belirlenemedi."),
    date: z.string().min(1, "Tarih seçin."),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Geçerli bir saat seçin."),
    status: z.enum(APPOINTMENT_STATUS_VALUES, { message: "Durum seçin." }),
    reason: z.string().trim().max(200, "Sebep 200 karakteri geçemez.").optional(),
    note: z.string().trim().max(2000, "Not 2000 karakteri geçemez.").optional(),
    treatmentPlanId: z.string().optional(),
    treatmentPlanItemId: z.string().optional(),
    /** "Tek Seans / Tek İşlem" — set together with `standalonePrice`, never alongside `treatmentPlanId`. */
    standaloneTreatmentName: z.string().trim().max(120, "İşlem adı 120 karakteri geçemez.").optional(),
    standalonePrice: z.number().min(0, "Fiyat negatif olamaz.").optional(),
    /** Sprint 31 — currency for the standalone treatment's price (TRY/EUR), carried into the hidden single-item plan. Required (form supplies "TRY" via defaults). */
    standaloneCurrency: z.enum(SUPPORTED_CURRENCIES),
    /** Planned follow-up date — package flow'daki gibi hasta + kalem/randevu bazında, opsiyonel. */
    controlDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (Boolean(data.treatmentPlanId) !== Boolean(data.treatmentPlanItemId)) {
      ctx.addIssue({ code: "custom", path: ["treatmentPlanItemId"], message: "Tedavi kalemi seçin." })
    }
    if (data.standaloneTreatmentName && data.standalonePrice === undefined) {
      ctx.addIssue({ code: "custom", path: ["standalonePrice"], message: "Fiyat girin." })
    }
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
  treatmentPlanId: "",
  treatmentPlanItemId: "",
  standaloneTreatmentName: "",
  standalonePrice: undefined,
  standaloneCurrency: "TRY",
  controlDate: "",
}

/**
 * Sprint 15 — reconstructs a full `updateAppointment` payload from a list
 * row's existing fields, changing only `status`. Reuses `updateAppointment`
 * as-is (no new "status-only" Server Action) for one-click quick actions
 * (dashboard "Geldi"/"Tamamlandı", agenda list "İptal Et") — same
 * `startsAt` → `date`/`time` split already used by `AppointmentEditSheet`.
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

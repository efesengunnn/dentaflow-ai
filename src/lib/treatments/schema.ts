import { z } from "zod"

const TREATMENT_STATUS_VALUES = ["active", "completed", "cancelled"] as const
const TREATMENT_PAYMENT_METHOD_VALUES = ["cash", "credit_card", "bank_transfer", "other"] as const
const TREATMENT_PAYMENT_CORRECTION_TYPE_VALUES = ["refund", "adjustment"] as const

/** "Yeni Paket Oluştur" — a treatment_series with no session yet (a package can be sold and paid before its first visit). */
export const treatmentSeriesFormSchema = z.object({
  patientId: z.string().min(1, "Hasta seçin."),
  treatmentType: z.string().trim().min(1, "Tedavi türünü girin.").max(120, "Tedavi türü 120 karakteri geçemez."),
  totalSessions: z.number().int().min(1, "En az 1 seans olmalı.").max(999, "Geçerli bir seans sayısı girin."),
  /** Optional (Sprint 8) — a phone-sold package's fee may not be negotiated yet. `undefined` renders as "Belirlenmedi", never a fake `0`. */
  totalFee: z.number().min(0, "Ücret negatif olamaz.").optional(),
})

export type TreatmentSeriesFormValues = z.infer<typeof treatmentSeriesFormSchema>

export const treatmentSeriesFormDefaults: TreatmentSeriesFormValues = {
  patientId: "",
  treatmentType: "",
  totalSessions: 1,
  totalFee: undefined,
}

/** "Paket Düzenle" (Sprint 8) — same three fields as creation, editable any time after. */
export const updateTreatmentSeriesSchema = z.object({
  seriesId: z.string().min(1),
  treatmentType: z.string().trim().min(1, "Tedavi türünü girin.").max(120, "Tedavi türü 120 karakteri geçemez."),
  totalSessions: z.number().int().min(1, "En az 1 seans olmalı.").max(999, "Geçerli bir seans sayısı girin."),
  totalFee: z.number().min(0, "Ücret negatif olamaz.").optional(),
})

export type UpdateTreatmentSeriesValues = z.infer<typeof updateTreatmentSeriesSchema>

/**
 * "Yeni Tedavi" (tek seferlik) — creates an invisible size-1 series and its
 * one session together, in one Server Action call (see
 * lib/treatments/actions.ts). The user never sees "series" language for
 * this path — see docs/DATABASE.md "every treatment always belongs to a
 * series".
 */
export const standaloneTreatmentFormSchema = z.object({
  patientId: z.string().min(1, "Hasta seçin."),
  staffId: z.string().min(1, "Personel seçin."),
  appointmentId: z.string().optional(),
  treatmentType: z.string().trim().min(1, "Tedavi türünü girin.").max(120, "Tedavi türü 120 karakteri geçemez."),
  /** Optional (Sprint 8) — see `treatmentSeriesFormSchema.totalFee`. */
  totalFee: z.number().min(0, "Ücret negatif olamaz.").optional(),
  treatmentDate: z.string().min(1, "Tarih seçin."),
  description: z.string().trim().max(2000, "Açıklama 2000 karakteri geçemez.").optional(),
  controlDate: z.string().optional(),
  status: z.enum(TREATMENT_STATUS_VALUES, { message: "Durum seçin." }),
})

export type StandaloneTreatmentFormValues = z.infer<typeof standaloneTreatmentFormSchema>

export const standaloneTreatmentFormDefaults: StandaloneTreatmentFormValues = {
  patientId: "",
  staffId: "",
  appointmentId: "",
  treatmentType: "",
  totalFee: undefined,
  treatmentDate: "",
  description: "",
  controlDate: "",
  status: "completed",
}

/** "Pakete Seans Ekle" — a new session on an existing treatment_series; treatmentType/fee are inherited, not re-entered. */
export const sessionFormSchema = z.object({
  seriesId: z.string().min(1, "Paket seçin."),
  staffId: z.string().min(1, "Personel seçin."),
  appointmentId: z.string().optional(),
  sessionNumber: z.number().int().min(1, "Geçerli bir seans numarası girin."),
  treatmentDate: z.string().min(1, "Tarih seçin."),
  description: z.string().trim().max(2000, "Açıklama 2000 karakteri geçemez.").optional(),
  controlDate: z.string().optional(),
  status: z.enum(TREATMENT_STATUS_VALUES, { message: "Durum seçin." }),
})

export type SessionFormValues = z.infer<typeof sessionFormSchema>

export const sessionFormDefaults: Omit<SessionFormValues, "seriesId" | "sessionNumber"> = {
  staffId: "",
  appointmentId: "",
  treatmentDate: "",
  description: "",
  controlDate: "",
  status: "completed",
}

/** "Ödeme Ekle" — always `entry_type = 'payment'`; refund/adjustment go through `treatmentPaymentCorrectionSchema` instead, referencing the entry they correct. */
export const treatmentPaymentFormSchema = z.object({
  seriesId: z.string().min(1, "Paket seçin."),
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  method: z.enum(TREATMENT_PAYMENT_METHOD_VALUES, { message: "Ödeme yöntemi seçin." }),
  paidAt: z.string().min(1, "Tarih seçin."),
  note: z.string().trim().max(500, "Not 500 karakteri geçemez.").optional(),
})

export type TreatmentPaymentFormValues = z.infer<typeof treatmentPaymentFormSchema>

export const treatmentPaymentFormDefaults: Omit<TreatmentPaymentFormValues, "seriesId"> = {
  amount: 0,
  method: "cash",
  paidAt: "",
  note: "",
}

/** "İade / Düzeltme" — always references the payment it corrects via `relatedPaymentId`. */
export const treatmentPaymentCorrectionSchema = z.object({
  seriesId: z.string().min(1),
  relatedPaymentId: z.string().min(1, "Düzeltilecek ödemeyi seçin."),
  entryType: z.enum(TREATMENT_PAYMENT_CORRECTION_TYPE_VALUES, { message: "Düzeltme türünü seçin." }),
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  method: z.enum(TREATMENT_PAYMENT_METHOD_VALUES, { message: "Ödeme yöntemi seçin." }),
  paidAt: z.string().min(1, "Tarih seçin."),
  note: z.string().trim().max(500, "Not 500 karakteri geçemez.").optional(),
})

export type TreatmentPaymentCorrectionValues = z.infer<typeof treatmentPaymentCorrectionSchema>

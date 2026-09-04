import { z } from "zod"

const TOOTH_TREATMENT_TYPE_VALUES = [
  "muayene",
  "dolgu",
  "kanal_tedavisi",
  "cekim",
  "kaplama",
  "implant",
  "kopru",
  "dis_tasi_temizligi",
  "beyazlatma",
  "diger",
] as const

const TOOTH_TREATMENT_STATUS_VALUES = ["planlandi", "tamamlandi", "iptal"] as const

export const toothTreatmentFormSchema = z
  .object({
    toothNumber: z.number().int(),
    treatmentType: z.enum(TOOTH_TREATMENT_TYPE_VALUES, { message: "İşlem türü seçin." }),
    customTreatmentName: z.string().trim().max(120, "İşlem adı 120 karakteri geçemez.").optional(),
    status: z.enum(TOOTH_TREATMENT_STATUS_VALUES, { message: "Durum seçin." }),
    price: z.number().min(0, "Fiyat negatif olamaz.").optional(),
    performedBy: z.string().min(1, "Sağlayıcı seçin."),
    performedAt: z.string().min(1, "Tarih seçin."),
    appointmentId: z.string().optional(),
    note: z.string().trim().max(2000, "Not 2000 karakteri geçemez.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.treatmentType === "diger" && !data.customTreatmentName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["customTreatmentName"], message: "İşlem adını yazın." })
    }
  })

export type ToothTreatmentFormValues = z.infer<typeof toothTreatmentFormSchema>

export const toothTreatmentFormDefaults: ToothTreatmentFormValues = {
  toothNumber: 0,
  treatmentType: "muayene",
  customTreatmentName: "",
  status: "planlandi",
  price: undefined,
  performedBy: "",
  performedAt: "",
  appointmentId: "",
  note: "",
}

export const patientPaymentFormSchema = z.object({
  amount: z.number().min(0.01, "Tutar girin."),
  paidAt: z.string().min(1, "Tarih seçin."),
  method: z.string().trim().max(60, "Yöntem 60 karakteri geçemez.").optional(),
  note: z.string().trim().max(500, "Not 500 karakteri geçemez.").optional(),
})

export type PatientPaymentFormValues = z.infer<typeof patientPaymentFormSchema>

export const patientPaymentFormDefaults: PatientPaymentFormValues = {
  amount: 0,
  paidAt: "",
  method: "",
  note: "",
}

export const treatmentCatalogItemFormSchema = z.object({
  treatmentType: z.enum(TOOTH_TREATMENT_TYPE_VALUES, { message: "İşlem türü seçin." }),
  name: z.string().trim().min(2, "İşlem adı en az 2 karakter olmalı."),
  defaultPrice: z.number().min(0, "Fiyat negatif olamaz.").optional(),
  isActive: z.boolean(),
})

export type TreatmentCatalogItemFormValues = z.infer<typeof treatmentCatalogItemFormSchema>

export const treatmentCatalogItemFormDefaults: TreatmentCatalogItemFormValues = {
  treatmentType: "dolgu",
  name: "",
  defaultPrice: undefined,
  isActive: true,
}

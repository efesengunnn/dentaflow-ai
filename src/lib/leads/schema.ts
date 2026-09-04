import { z } from "zod"

const LEAD_STATUS_VALUES = [
  "new",
  "contacted",
  "consultation_scheduled",
  "proposal_sent",
  "converted",
  "lost",
] as const

const LEAD_SOURCE_VALUES = [
  "website",
  "referral",
  "social_media",
  "phone_call",
  "walk_in",
  "other",
] as const

export const leadFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı."),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Geçerli bir telefon numarası girin (10 haneli, başında 0 olmadan)."),
  email: z
    .union([z.string().trim().email("Geçerli bir e-posta adresi girin."), z.literal("")])
    .optional(),
  source: z.enum(LEAD_SOURCE_VALUES, {
    message: "Kaynak seçin.",
  }),
  status: z.enum(LEAD_STATUS_VALUES, {
    message: "Durum seçin.",
  }),
  assignedTo: z.string().optional(),
  note: z
    .string()
    .trim()
    .max(2000, "Not 2000 karakteri geçemez.")
    .optional(),
})

export type LeadFormValues = z.infer<typeof leadFormSchema>

export const leadFormDefaults: LeadFormValues = {
  fullName: "",
  phone: "",
  email: "",
  source: "other",
  status: "new",
  assignedTo: "",
  note: "",
}

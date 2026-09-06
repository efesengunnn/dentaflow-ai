import { z } from "zod"

export const patientFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı."),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Geçerli bir telefon numarası girin (10 haneli, başında 0 olmadan)."),
    email: z
      .union([z.string().trim().email("Geçerli bir e-posta adresi girin."), z.literal("")])
      .optional(),
    tcKimlikNo: z
      .union([z.string().trim().regex(/^\d{11}$/, "TC Kimlik No 11 haneli olmalı."), z.literal("")])
      .optional(),
    dateOfBirth: z.string().optional(),
    note: z.string().trim().max(2000, "Not 2000 karakteri geçemez.").optional(),
    // "Aynı anda randevu oluştur" — create mode only, ignored by updatePatient.
    createAppointment: z.boolean().optional(),
    appointmentStaffId: z.string().optional(),
    appointmentDate: z.string().optional(),
    appointmentTime: z.string().optional(),
    // Founder decision 2026-07-28 — optional, same "Belirlenmedi" fee
    // convention as the standalone appointment form's own treatment section.
    treatmentType: z.string().trim().optional(),
    totalFee: z.number().min(0, "Ücret negatif olamaz.").optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.createAppointment) return
    if (!data.appointmentStaffId) {
      ctx.addIssue({ code: "custom", path: ["appointmentStaffId"], message: "Personel seçin." })
    }
    if (!data.appointmentDate) {
      ctx.addIssue({ code: "custom", path: ["appointmentDate"], message: "Tarih seçin." })
    }
    if (!data.appointmentTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.appointmentTime)) {
      ctx.addIssue({ code: "custom", path: ["appointmentTime"], message: "Geçerli bir saat seçin." })
    }
  })

export type PatientFormValues = z.infer<typeof patientFormSchema>

export const patientFormDefaults: PatientFormValues = {
  fullName: "",
  phone: "",
  email: "",
  tcKimlikNo: "",
  dateOfBirth: "",
  note: "",
  createAppointment: false,
  appointmentStaffId: "",
  appointmentDate: "",
  appointmentTime: "",
  treatmentType: "",
  totalFee: undefined,
}

import { z } from "zod"

export const clinicSettingsFormSchema = z.object({
  name: z.string().trim().min(2, "Klinik adı en az 2 karakter olmalı."),
  phone: z
    .union([z.string().trim().regex(/^\d{10}$/, "Geçerli bir telefon numarası girin (10 haneli, başında 0 olmadan)."), z.literal("")])
    .optional(),
  email: z.union([z.string().trim().email("Geçerli bir e-posta adresi girin."), z.literal("")]).optional(),
  address: z.string().trim().max(500, "Adres 500 karakteri geçemez.").optional(),
  logoUrl: z.union([z.string().trim().url("Geçerli bir bağlantı girin."), z.literal("")]).optional(),
  businessHours: z.string().trim().max(200, "Çalışma saatleri 200 karakteri geçemez.").optional(),
})

export type ClinicSettingsFormValues = z.infer<typeof clinicSettingsFormSchema>

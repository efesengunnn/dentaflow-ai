import { z } from "zod"

const staffRoleSchema = z.enum(["owner", "doctor", "secretary", "beauty_specialist"])

export const staffInviteFormSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı."),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin."),
  phone: z
    .union([z.string().trim().regex(/^\d{10}$/, "Geçerli bir telefon numarası girin (10 haneli, başında 0 olmadan)."), z.literal("")])
    .optional(),
  role: staffRoleSchema,
})

export type StaffInviteFormValues = z.infer<typeof staffInviteFormSchema>

export const staffInviteFormDefaults: StaffInviteFormValues = {
  fullName: "",
  email: "",
  phone: "",
  role: "secretary",
}

export const staffEditFormSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı."),
  phone: z
    .union([z.string().trim().regex(/^\d{10}$/, "Geçerli bir telefon numarası girin (10 haneli, başında 0 olmadan)."), z.literal("")])
    .optional(),
  role: staffRoleSchema,
})

export type StaffEditFormValues = z.infer<typeof staffEditFormSchema>

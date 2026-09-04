"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { clinicSettingsFormSchema, type ClinicSettingsFormValues } from "@/lib/clinic/schema"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

export type ClinicActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

/**
 * Owner-only, per Sprint 26 brief — RLS's `clinics_update_owner` enforces
 * this independently, the role check here only produces a clean error
 * instead of a bare RLS failure.
 */
export async function updateClinicSettings(values: ClinicSettingsFormValues): Promise<ClinicActionState> {
  const parsed = clinicSettingsFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("clinics")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      logo_url: parsed.data.logoUrl || null,
      business_hours: parsed.data.businessHours || null,
    })
    .eq("id", staffMember.clinicId)

  if (error) return { error: "Klinik bilgileri güncellenemedi." }

  revalidatePath("/settings/clinic")
  return { success: true }
}

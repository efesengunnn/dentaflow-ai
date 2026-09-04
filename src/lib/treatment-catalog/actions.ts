"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { treatmentCatalogItemFormSchema, type TreatmentCatalogItemFormValues } from "@/lib/teeth/schema"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

export type CatalogActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

export async function createCatalogItem(values: TreatmentCatalogItemFormValues): Promise<CatalogActionState> {
  const parsed = treatmentCatalogItemFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase.from("treatment_catalog").insert({
    clinic_id: staffMember.clinicId,
    treatment_type: parsed.data.treatmentType,
    name: parsed.data.name,
    default_price: parsed.data.defaultPrice ?? null,
    is_active: parsed.data.isActive,
    created_by: staffMember.userId,
    updated_by: staffMember.userId,
  })

  if (error) return { error: "İşlem eklenemedi." }

  revalidatePath("/settings/treatments")
  return { success: true }
}

export async function updateCatalogItem(
  itemId: string,
  values: TreatmentCatalogItemFormValues,
): Promise<CatalogActionState> {
  const parsed = treatmentCatalogItemFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("treatment_catalog")
    .update({
      treatment_type: parsed.data.treatmentType,
      name: parsed.data.name,
      default_price: parsed.data.defaultPrice ?? null,
      is_active: parsed.data.isActive,
      updated_by: staffMember.userId,
    })
    .eq("id", itemId)

  if (error) return { error: "İşlem güncellenemedi." }

  revalidatePath("/settings/treatments")
  return { success: true }
}

export async function removeCatalogItem(itemId: string): Promise<CatalogActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase.from("treatment_catalog").delete().eq("id", itemId)

  if (error) return { error: "İşlem silinemedi." }

  revalidatePath("/settings/treatments")
  return { success: true }
}

"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"
import { catalogItemFormSchema, type CatalogItemFormValues } from "./schema"
import { getCatalogForStaff, type CatalogItem } from "./queries"

/**
 * Client-callable wrapper — same "on demand, once a section is opened"
 * pattern as `fetchActiveSeriesForPatient` (lib/treatments/actions.ts):
 * `AppointmentTreatmentSection` fetches this only once "+ Tedavi Tanımla"
 * is open and a staff member is selected, never on every form render.
 */
export async function fetchCatalogForStaff(staffId: string): Promise<CatalogItem[]> {
  if (!staffId) return []
  return getCatalogForStaff(staffId)
}

export type CatalogActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

/** Owner-only, per the founder's explicit 2026-07-28 decision — RLS enforces this independently, the role check here just produces a clean error instead of a bare RLS failure. */
export async function createCatalogItem(values: CatalogItemFormValues): Promise<CatalogActionState> {
  const parsed = catalogItemFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase.from("staff_treatment_catalog_items").insert({
    clinic_id: staffMember.clinicId,
    staff_id: parsed.data.staffId,
    treatment_type: parsed.data.treatmentType,
    default_price: parsed.data.defaultPrice ?? null,
    created_by: staffMember.userId,
    updated_by: staffMember.userId,
  })

  if (error) {
    const isDuplicate = error.message.toLowerCase().includes("duplicate")
    return { error: isDuplicate ? "Bu personel için bu tedavi zaten kayıtlı." : "Tedavi eklenemedi." }
  }

  revalidatePath("/settings/treatments")
  return { success: true }
}

export async function updateCatalogItem(
  itemId: string,
  values: Pick<CatalogItemFormValues, "treatmentType" | "defaultPrice">,
): Promise<CatalogActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff_treatment_catalog_items")
    .update({
      treatment_type: values.treatmentType,
      default_price: values.defaultPrice ?? null,
      updated_by: staffMember.userId,
    })
    .eq("id", itemId)

  if (error) return { error: "Tedavi güncellenemedi." }

  revalidatePath("/settings/treatments")
  return { success: true }
}

export async function setCatalogItemActive(itemId: string, isActive: boolean): Promise<CatalogActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff_treatment_catalog_items")
    .update({ is_active: isActive, updated_by: staffMember.userId })
    .eq("id", itemId)

  if (error) return { error: "Güncellenemedi." }

  revalidatePath("/settings/treatments")
  return { success: true }
}

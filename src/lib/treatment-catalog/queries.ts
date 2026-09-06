import { createClient } from "@/lib/supabase/server"

export type CatalogItem = {
  id: string
  staffId: string
  treatmentType: string
  /** `null` — "Belirlenmedi", same convention as treatment_series.totalFee. */
  defaultPrice: number | null
  isActive: boolean
}

/**
 * A single staff member's active catalog — feeds the "Bu randevuda bir
 * tedavi planlanacak mı?" picker on the appointment form. RLS already
 * scopes this to the caller's own clinic (`..._select_own_clinic`), so no
 * extra clinic_id filter is needed here.
 */
export async function getCatalogForStaff(staffId: string): Promise<CatalogItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("staff_treatment_catalog_items")
    .select("id, staff_id, treatment_type, default_price, is_active")
    .eq("staff_id", staffId)
    .eq("is_active", true)
    .order("treatment_type")

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    treatmentType: row.treatment_type,
    defaultPrice: row.default_price,
    isActive: row.is_active,
  }))
}

export type CatalogItemWithStaff = CatalogItem & { staffName: string }

/**
 * Every catalog item (active and inactive) across every staff member,
 * grouped by staff in the caller's own memory — feeds the owner-only
 * Ayarlar management screen. `is_active: false` rows are included
 * deliberately (the screen needs to show and let the owner re-activate
 * them, not just hide them silently).
 */
export async function getCatalogForClinic(): Promise<CatalogItemWithStaff[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("staff_treatment_catalog_items")
    .select("id, staff_id, treatment_type, default_price, is_active, staff:staff_members!staff_id(full_name)")
    .order("treatment_type")

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    treatmentType: row.treatment_type,
    defaultPrice: row.default_price,
    isActive: row.is_active,
    staffName: row.staff?.full_name ?? "—",
  }))
}

import type { ToothTreatmentType } from "@/lib/teeth/constants"
import { createClient } from "@/lib/supabase/server"

export type CatalogItem = {
  id: string
  treatmentType: ToothTreatmentType
  name: string
  defaultPrice: number | null
  isActive: boolean
}

export async function getTreatmentCatalog(includeInactive = false): Promise<CatalogItem[]> {
  const supabase = await createClient()
  let query = supabase
    .from("treatment_catalog")
    .select("id, treatment_type, name, default_price, is_active")
    .order("name", { ascending: true })

  if (!includeInactive) query = query.eq("is_active", true)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    treatmentType: row.treatment_type,
    name: row.name,
    defaultPrice: row.default_price,
    isActive: row.is_active,
  }))
}

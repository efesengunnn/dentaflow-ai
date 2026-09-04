import { createClient } from "@/lib/supabase/server"

export type ClinicSettings = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  logoUrl: string | null
  businessHours: string | null
}

/** RLS-scoped to the caller's own clinic (`clinics_select_own`) — any role may read it. */
export async function getClinicSettings(clinicId: string): Promise<ClinicSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, phone, email, address, logo_url, business_hours")
    .eq("id", clinicId)
    .single()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    logoUrl: data.logo_url,
    businessHours: data.business_hours,
  }
}

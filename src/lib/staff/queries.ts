import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type AssignableStaff = {
  id: string
  fullName: string
  role: Database["public"]["Enums"]["staff_role"]
}

/**
 * Active staff in the caller's own clinic (RLS-scoped) — feeds the "Sorumlu
 * Personel" Combobox/filter on every module that supports assignment
 * (leads, patients, ...). Not module-specific, so it lives here rather than
 * under `lib/leads/` or `lib/patients/`.
 */
export async function getAssignableStaff(): Promise<AssignableStaff[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, full_name, role")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name")

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
  }))
}

export type StaffMemberRow = {
  id: string
  fullName: string
  phone: string | null
  role: Database["public"]["Enums"]["staff_role"]
  isActive: boolean
}

/**
 * Every non-deleted staff member in the clinic, active and inactive — feeds
 * the Personel list page (Sprint 26). Unlike `getAssignableStaff`, this
 * deliberately includes inactive rows so an owner can find and reactivate
 * someone; the list page itself renders their status, it isn't hidden here.
 * Soft-deleted rows (`deleted_at`) are excluded — that action is permanent.
 */
export async function getStaffMembersForClinic(): Promise<StaffMemberRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, full_name, phone, role, is_active")
    .is("deleted_at", null)
    .order("full_name")

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    isActive: row.is_active,
  }))
}

"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import type { PermissionKey } from "@/lib/permissions/queries"
import { createClient } from "@/lib/supabase/server"

export type PermissionActionState = { error: string; success?: undefined } | { success: true; error?: undefined } | undefined

/**
 * Owner-only, per docs/DATABASE.md's Role/Permission section — RLS enforces
 * this independently (`staff_permissions_insert_owner_only`), the role
 * check here is only for a clean, specific error message rather than a bare
 * RLS 403 reaching the UI.
 */
export async function grantPermission(staffId: string, key: PermissionKey): Promise<PermissionActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase.from("staff_permissions").insert({
    clinic_id: staffMember.clinicId,
    staff_id: staffId,
    permission_key: key,
    granted_by: staffMember.userId,
  })

  // A repeat grant hits the (staff_id, permission_key) unique constraint —
  // not a real failure, the end state the caller wanted is already true.
  if (error && error.code !== "23505") {
    return { error: "Yetki verilemedi." }
  }

  revalidatePath("/settings/roles")
  return { success: true }
}

export async function revokePermission(staffId: string, key: PermissionKey): Promise<PermissionActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff_permissions")
    .delete()
    .eq("staff_id", staffId)
    .eq("permission_key", key)

  if (error) return { error: "Yetki kaldırılamadı." }

  revalidatePath("/settings/roles")
  return { success: true }
}

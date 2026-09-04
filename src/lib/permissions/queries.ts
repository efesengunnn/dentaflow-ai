import { createClient } from "@/lib/supabase/server"

/** The one permission that exists today — see docs/DATABASE.md#staff_permissions on why this is `text` + `CHECK`, not an enum. */
export type PermissionKey = "financial_access"

/**
 * Whether the *current session* holds a permission — calls the
 * `current_staff_has_permission` RPC (SECURITY DEFINER, resolves via
 * `auth.uid()`), same trust boundary as `current_clinic_id()`/
 * `current_staff_role()`. This is the one function every financial-
 * aggregate query/route should gate on — see
 * docs/ARCHITECTURE.md's AI Data Access section for why raw table access
 * must never substitute for this check once AI exists.
 */
export async function currentStaffHasPermission(key: PermissionKey): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("current_staff_has_permission", { p_key: key })
  if (error) throw error
  return data ?? false
}

export type StaffPermissionRow = {
  staffId: string
  staffName: string
  role: string
  hasFinancialAccess: boolean
}

/**
 * Every active staff member in the clinic, with their `financial_access`
 * status — feeds an Owner-only "kime finansal yetki verildi" management
 * view. RLS already scopes `staff_permissions` to "own row, or Owner sees
 * all" (docs/DATABASE.md), so a non-Owner caller here just gets back
 * `hasFinancialAccess: false` for everyone but themselves — this function
 * doesn't need its own role check, RLS already shapes the result correctly.
 */
export async function getStaffPermissionsForClinic(): Promise<StaffPermissionRow[]> {
  const supabase = await createClient()

  const [{ data: staff, error: staffError }, { data: grants, error: grantsError }] = await Promise.all([
    supabase.from("staff_members").select("id, full_name, role").eq("is_active", true).order("full_name"),
    supabase.from("staff_permissions").select("staff_id, permission_key"),
  ])

  if (staffError) throw staffError
  if (grantsError) throw grantsError

  const financialAccessStaffIds = new Set(
    (grants ?? []).filter((row) => row.permission_key === "financial_access").map((row) => row.staff_id),
  )

  return (staff ?? []).map((row) => ({
    staffId: row.id,
    staffName: row.full_name,
    role: row.role,
    hasFinancialAccess: financialAccessStaffIds.has(row.id),
  }))
}

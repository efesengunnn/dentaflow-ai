import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

/**
 * Service-role client — bypasses RLS entirely. Narrowly scoped: used by
 * `inviteStaffMember` (`auth.admin.generateLink`, to create the invited
 * person's `auth.users` row) and `deleteStaffMember` (`auth.admin.updateUserById`,
 * to archive the departed staff member's email) in src/lib/staff/actions.ts —
 * both need `auth.users` mutations no RLS-scoped session can ever perform.
 * Never import this from a Client Component; never use it as a shortcut
 * around RLS for anything a normal `createClient()` session could already do.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

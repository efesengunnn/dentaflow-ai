import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type StaffRole } from "@/lib/staff/constants";

export { ROLE_LABELS };

export type CurrentStaffMember = {
  userId: string;
  email: string | null;
  fullName: string;
  role: StaffRole;
  roleLabel: string;
  clinicId: string;
  clinicName: string;
};

/**
 * Server-side only: resolves the signed-in user's staff_members + clinics
 * row in one call. Returns null if there's no session, or if the session
 * exists but has no matching staff_members row yet (shouldn't happen for a
 * properly provisioned account, but is not treated as an error here — the
 * caller decides what to do).
 *
 * Wrapped in React's `cache()`: `(app)/layout.tsx` and most `page.tsx` files
 * both call this per request (the layout to resolve the sidebar identity,
 * the page for role-gating). Without `cache()` that's two round trips to
 * Supabase Auth + Postgres on every navigation; `cache()` deduplicates
 * identical calls within the same request render pass, so it's one.
 */
export const getCurrentStaffMember = cache(async (): Promise<CurrentStaffMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // `clinics!staff_members_clinic_id_fkey` disambiguates the embed: `clinics`
  // now has a *second* FK back to `staff_members` (`clinics.updated_by`, added
  // for audit tracking), so an unqualified `clinics(name)` embed is ambiguous
  // to PostgREST (PGRST201) and silently fails the whole staff-member lookup.
  // is_active/deleted_at are checked here (not just RLS) so a deactivated or
  // deleted staff member's *existing* session loses access on their very next
  // request — previously neither was enforced anywhere past the RLS row
  // still being readable, so "Pasifleştir" didn't actually block login.
  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("full_name, role, clinic_id, clinics!staff_members_clinic_id_fkey(name)")
    .eq("id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!staffMember) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: staffMember.full_name,
    role: staffMember.role,
    roleLabel: ROLE_LABELS[staffMember.role],
    clinicId: staffMember.clinic_id,
    clinicName: staffMember.clinics?.name ?? "Klinik",
  };
})

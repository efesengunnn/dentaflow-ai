"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { staffEditFormSchema, staffInviteFormSchema, type StaffEditFormValues, type StaffInviteFormValues } from "@/lib/staff/schema"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

export type StaffActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; inviteLink?: string; error?: undefined }
  | undefined

/**
 * Owner-only, per Sprint 26 brief ("Mevcut permission sistemini kullan") —
 * RLS's `staff_insert_owner` enforces this independently, the role check
 * here only produces a clean error instead of a bare RLS failure.
 *
 * Creates the `auth.users` row via the service-role admin client (no RLS-
 * scoped session can do this), then inserts `staff_members` immediately in
 * the same request using the *caller's* normal session — the invited person
 * is a real, active team member from the moment the owner clicks "Davet Et",
 * they just haven't set a password yet. `generateLink` (not
 * `inviteUserByEmail`) is used deliberately: it returns a copyable
 * `action_link` that works even when this environment's SMTP isn't
 * configured, so the owner can always share it manually as a fallback.
 */
export async function inviteStaffMember(values: StaffInviteFormValues): Promise<StaffActionState> {
  const parsed = staffInviteFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  // NEXT_PUBLIC_SITE_URL wins when set (the real domain, once one is connected).
  // Otherwise fall back to Vercel's own per-deployment URL (VERCEL_URL, server-only,
  // auto-injected — no manual config per preview deploy), then localhost for local dev.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const admin = createAdminClient()

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: { redirectTo: `${siteUrl}/davet` },
  })

  if (linkError || !linkData.user) {
    const alreadyExists = linkError?.message?.toLowerCase().includes("already been registered")
    return {
      error: alreadyExists
        ? "Bu e-posta adresi zaten kullanımda."
        : "Davet oluşturulamadı. E-posta adresini kontrol edip tekrar deneyin.",
    }
  }

  const supabase = await createClient()
  const { error: insertError } = await supabase.from("staff_members").insert({
    id: linkData.user.id,
    clinic_id: staffMember.clinicId,
    role: parsed.data.role,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    created_by: staffMember.userId,
    updated_by: staffMember.userId,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(linkData.user.id)
    return { error: "Personel kaydı oluşturulamadı." }
  }

  // No revalidatePath here, deliberately: the invite sheet stays open to show
  // a copyable link after success, and /staff is already dynamically rendered
  // (cookies()-based Supabase client), so revalidating here only serves to
  // refresh the client router mid-transition — which remounts the sheet and
  // wipes that link out from under the owner before they can copy it (barely
  // noticeable on local Supabase's near-zero latency, very noticeable against
  // real network latency). The sheet calls router.refresh() itself once closed.
  return { success: true, inviteLink: linkData.properties.action_link }
}

export async function updateStaffMember(staffId: string, values: StaffEditFormValues): Promise<StaffActionState> {
  const parsed = staffEditFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff_members")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      updated_by: staffMember.userId,
    })
    .eq("id", staffId)

  if (error) return { error: "Personel güncellenemedi." }

  revalidatePath("/staff")
  return { success: true }
}

async function setStaffActive(staffId: string, isActive: boolean): Promise<StaffActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }
  if (staffId === staffMember.userId) return { error: "Kendi hesabınızı pasifleştiremezsiniz." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff_members")
    .update({ is_active: isActive, updated_by: staffMember.userId })
    .eq("id", staffId)

  if (error) return { error: isActive ? "Personel aktifleştirilemedi." : "Personel pasifleştirilemedi." }

  revalidatePath("/staff")
  return { success: true }
}

export async function deactivateStaffMember(staffId: string): Promise<StaffActionState> {
  return setStaffActive(staffId, false)
}

export async function reactivateStaffMember(staffId: string): Promise<StaffActionState> {
  return setStaffActive(staffId, true)
}

/**
 * Permanent, unlike deactivate — same soft-delete shape as
 * softDeletePatient/softDeleteLead/softDeleteAppointment. `staff_members`
 * has no DELETE RLS policy by design (see Sprint 2 migration comment: it's
 * the actor identity behind created_by/updated_by/assigned_to everywhere
 * else), so this is an UPDATE the existing staff_update_owner_or_self
 * policy already allows. is_active is cleared alongside deleted_at so the
 * login check in getCurrentStaffMember rejects the session immediately.
 *
 * The `auth.users` row is deliberately never removed (same
 * created_by/updated_by referential-integrity reasoning as above), but its
 * email is archived via the admin API right after the soft-delete so the
 * address is immediately free for a new invite — without this, re-inviting
 * the same email after deleting a staff member fails with "already in
 * use" until someone manually frees it (see docs/CHANGELOG.md). Best-effort:
 * a failure here doesn't block the delete, since the staff member is
 * already fully deactivated at that point.
 */
export async function deleteStaffMember(staffId: string): Promise<StaffActionState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner") return { error: "Bu işlem için yetkiniz yok." }
  if (staffId === staffMember.userId) return { error: "Kendi hesabınızı silemezsiniz." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff_members")
    .update({ deleted_at: new Date().toISOString(), is_active: false, updated_by: staffMember.userId })
    .eq("id", staffId)

  if (error) return { error: "Personel silinemedi." }

  const admin = createAdminClient()
  const { data: authUser } = await admin.auth.admin.getUserById(staffId)
  if (authUser?.user?.email) {
    await admin.auth.admin.updateUserById(staffId, {
      email: archiveEmail(authUser.user.email),
    })
  }

  revalidatePath("/staff")
  return { success: true }
}

/** `info@domain.com` -> `info+deleted-1735689600000@domain.com` — stays a valid, unique address. */
function archiveEmail(email: string): string {
  return email.replace("@", `+deleted-${Date.now()}@`)
}

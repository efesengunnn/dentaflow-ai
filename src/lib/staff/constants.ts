import type { Database } from "@/lib/supabase/database.types"

type StaffRole = Database["public"]["Enums"]["staff_role"]

/**
 * Lives here (not in `lib/auth/get-current-staff-member.ts`, its original
 * Sprint 2 home) so Client Components can import role labels without
 * pulling in that file's `next/headers` dependency — see Sprint 26's build
 * failure when `staff-columns.tsx` etc. imported it directly.
 */
export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Klinik Sahibi",
  doctor: "Diş Hekimi",
  secretary: "Sekreter",
  // `beauty_specialist` is a carried-over enum value from the ClinicFlow
  // bootstrap; in a dental clinic it stands for non-dentist clinical staff
  // (assistant/hygienist), so the user-facing label is dental-neutral. The
  // enum value itself is left unchanged (RLS policies reference it).
  beauty_specialist: "Klinik Personeli",
}

export type { StaffRole }

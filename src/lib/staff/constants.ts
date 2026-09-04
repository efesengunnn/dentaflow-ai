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
  doctor: "Doktor",
  secretary: "Sekreter",
  beauty_specialist: "Güzellik Uzmanı",
}

export type { StaffRole }

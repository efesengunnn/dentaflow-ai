import {
  getClinicPackageStatusForAI,
  getNewPatientStatsForAI,
  getNoShowCountForAI,
  getTodayAppointmentsForAI,
  getUpcomingAppointmentsForAI,
} from "@/lib/ai/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getFinancialOverview } from "@/lib/dashboard/queries"
import { currentStaffHasPermission } from "@/lib/permissions/queries"
import type { StaffRole } from "@/lib/staff/constants"

export type AIRequestIdentity = {
  staffId: string
  clinicId: string
  staffName: string
  role: StaffRole
  hasFinancialAccess: boolean
}

/** Server-side identity resolution for the AI panel — never trusts client-supplied role/permission claims. */
export async function resolveAIRequestIdentity(): Promise<AIRequestIdentity | null> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  const hasFinancialAccess = await currentStaffHasPermission("financial_access")
  return {
    staffId: staffMember.userId,
    clinicId: staffMember.clinicId,
    staffName: staffMember.fullName,
    role: staffMember.role,
    hasFinancialAccess,
  }
}

export type AIContextSnapshot = {
  todayAppointments: Awaited<ReturnType<typeof getTodayAppointmentsForAI>>
  upcomingAppointments: Awaited<ReturnType<typeof getUpcomingAppointmentsForAI>>
  packageStatus: Awaited<ReturnType<typeof getClinicPackageStatusForAI>>
  newPatientsThisMonth: number | null
  noShowsThisMonth: number | null
  financialSummary: { monthlyRevenueTRY: number; outstandingBalanceTRY: number } | null
}

/**
 * Role-based snapshot injected into the agent's system instructions on
 * every request — gives the model ambient awareness of today's clinic state
 * without a tool round trip for the common case. `newPatientsThisMonth` /
 * `noShowsThisMonth` / `financialSummary` are `null` for a caller without
 * `financial_access` (the founder's "Owner"-only bucket, Sprint 27 spec) —
 * everything else is identical for both. Calling `getFinancialOverview()`
 * here reuses its own `financial_dashboard_view` audit logging as-is: the AI
 * panel surfacing the clinic-wide financial aggregate genuinely IS "opening
 * the financial-aggregate view," through a new channel, so it should be
 * logged the same way the Dashboard route already is — not a second,
 * parallel implementation of that check (docs/ARCHITECTURE.md's AI Data
 * Access Principle).
 */
export async function buildAIContextSnapshot(identity: AIRequestIdentity): Promise<AIContextSnapshot> {
  const [todayAppointments, upcomingAppointments, packageStatus, newPatientsThisMonth, noShowsThisMonth, financialOverview] =
    await Promise.all([
      getTodayAppointmentsForAI(),
      getUpcomingAppointmentsForAI(),
      getClinicPackageStatusForAI(),
      getNewPatientStatsForAI(identity.hasFinancialAccess),
      getNoShowCountForAI(identity.hasFinancialAccess),
      identity.hasFinancialAccess ? getFinancialOverview() : Promise.resolve(null),
    ])

  return {
    todayAppointments,
    upcomingAppointments,
    packageStatus,
    newPatientsThisMonth,
    noShowsThisMonth,
    financialSummary: financialOverview
      ? {
          // Sprint 32 — the overview is per currency now (TRY + EUR possible);
          // this snapshot keeps its TRY-only shape, taking the TRY slice.
          monthlyRevenueTRY: financialOverview.monthlyRevenue.find((row) => row.currency === "TRY")?.amount ?? 0,
          outstandingBalanceTRY:
            financialOverview.outstandingBalance.find((row) => row.currency === "TRY")?.amount ?? 0,
        }
      : null,
  }
}

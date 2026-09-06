import { SESSION_CORRECTION_WINDOW_HOURS } from "@/lib/treatment-plans/constants"
import type { StaffRole } from "@/lib/staff/constants"

/**
 * Single shared authorization surface for the Treatment Plan module —
 * replaces the three independently-drifted inline `canManageTreatments`/
 * `canManagePayments`/`canCorrectPayments` expressions previously
 * duplicated across `patients/[id]/page.tsx`, `dashboard/page.tsx`, and
 * `appointments/[id]/page.tsx` (flagged as a real drift risk in Sprint 7's
 * own architecture review). Every function here mirrors an RLS policy in
 * `supabase/migrations/20260810*_create_treatment_plan*.sql` /
 * `..._create_treatment_sessions.sql` — RLS remains the actual security
 * boundary, this module exists for consistent UI affordance gating and
 * clear Turkish error messages ahead of the RLS-denied case.
 */
export type TreatmentPlanActor = {
  staffId: string
  role: StaffRole
  hasFinancialAccess: boolean
}

export type CorrectableSession = {
  performedBy: string
  createdAt: string
  status: "completed" | "corrected" | "voided"
}

/** Mirrors `treatment_plans_insert_clinical_and_front_desk` / `treatment_plan_items_insert_clinical_and_front_desk` / `treatment_sessions_insert_clinical_and_front_desk` — every staff role may create a plan. */
export function canCreateTreatmentPlan(actor: TreatmentPlanActor): boolean {
  return ["owner", "doctor", "beauty_specialist", "secretary"].includes(actor.role)
}

/** Mirrors `treatment_plans_update_clinical_roles` / `treatment_plan_items_update_clinical_roles` — revising a plan's structure (session count, provider, price) is not a front-desk action. */
export function canReviseTreatmentPlan(actor: TreatmentPlanActor): boolean {
  return actor.role === "owner" || actor.role === "doctor" || actor.role === "beauty_specialist"
}

/** Completing a session is an INSERT into `treatment_sessions` — same role set as plan creation. */
export function canCompleteSession(actor: TreatmentPlanActor): boolean {
  return canCreateTreatmentPlan(actor)
}

/**
 * Mirrors `treatment_sessions_update_correction_rules`: owner may correct
 * or void any session at any age; doctor/beauty_specialist only their own
 * `performed_by` session; secretary any session, but only within
 * `SESSION_CORRECTION_WINDOW_HOURS` of when it was entered
 * (`created_at`, not the clinical `performed_at` date — see
 * `SESSION_CORRECTION_WINDOW_HOURS`'s doc comment for why). A session
 * already `corrected`/`voided` is terminal regardless of role.
 */
export function canCorrectOrVoidSession(
  actor: TreatmentPlanActor,
  session: CorrectableSession,
  now: Date = new Date(),
): boolean {
  if (session.status !== "completed") return false
  if (actor.role === "owner") return true
  if (actor.role === "doctor" || actor.role === "beauty_specialist") {
    return session.performedBy === actor.staffId
  }
  if (actor.role === "secretary") {
    const hoursSinceCreated = (now.getTime() - new Date(session.createdAt).getTime()) / (1000 * 60 * 60)
    return hoursSinceCreated < SESSION_CORRECTION_WINDOW_HOURS
  }
  return false
}

/** Mirrors the current `treatment_payments` INSERT policy (`owner`, `secretary`, `beauty_specialist` — widened to include `beauty_specialist` per founder decision 2026-07-28). Unchanged by the Sprint 28 redesign. */
export function canRecordPayment(actor: TreatmentPlanActor): boolean {
  return actor.role === "owner" || actor.role === "secretary" || actor.role === "beauty_specialist"
}

/** A refund/adjustment entry is more sensitive than an ordinary payment — stays `owner`/`secretary`-only, same rule as today's `canCorrectPayments`. */
export function canCorrectPayment(actor: TreatmentPlanActor): boolean {
  return actor.role === "owner" || actor.role === "secretary"
}

/** Soft-deleting a plan (and cascading to its items) is a structural change — same authority as revising one. Mirrors `treatment_plans_update_clinical_roles`. */
export function canDeleteTreatmentPlan(actor: TreatmentPlanActor): boolean {
  return canReviseTreatmentPlan(actor)
}

/** Same authority as deleting the parent plan. Mirrors `treatment_plan_items_update_clinical_roles`. */
export function canDeleteTreatmentPlanItem(actor: TreatmentPlanActor): boolean {
  return canReviseTreatmentPlan(actor)
}

/**
 * Soft-deleting a session is the same class of action as correcting or
 * voiding it — hiding a realized visit from active screens deserves the
 * exact same actor rule as rewriting its outcome, so this is a direct alias
 * of `canCorrectOrVoidSession` (Sprint 28C.1), not a separate policy.
 */
export function canDeleteTreatmentSession(
  actor: TreatmentPlanActor,
  session: CorrectableSession,
  now: Date = new Date(),
): boolean {
  return canCorrectOrVoidSession(actor, session, now)
}

export type TreatmentFieldVisibility = {
  /** `treatment_plans.total_amount` / `paid_amount` / `remaining_amount` (all derived) — Tier-1, unconditional per founder decision (needed operationally to collect payment). */
  planAmounts: boolean
  /** `treatment_plan_items.unit_price` / `total_price` — same Tier-1 reasoning as planAmounts. */
  itemPrice: boolean
  /** `treatment_plan_items.provider_share_amount` — owner-only, not even the provider themself (founder decision, Sprint 28: this is revenue attribution, not commission). */
  providerShare: boolean
  /** Clinic-wide aggregates (revenue rollups, staff comparison, exports) — Tier-3, gated on `financial_access`. */
  clinicAggregates: boolean
}

export function getTreatmentFieldVisibility(actor: TreatmentPlanActor): TreatmentFieldVisibility {
  return {
    planAmounts: true,
    itemPrice: true,
    providerShare: actor.role === "owner",
    clinicAggregates: actor.hasFinancialAccess,
  }
}

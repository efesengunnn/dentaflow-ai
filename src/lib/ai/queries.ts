import type { AppointmentStatus } from "@/lib/appointments/constants"
import { summarizePatientTreatments, type PatientTreatmentSummary } from "@/lib/ai/summary"
import { getTodaysAppointments, getUpcomingAppointments, startOfMonthISOString } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import { sanitizeSearchTerm } from "@/lib/supabase/query-helpers"
import { deriveItemProgress, derivePlanProgress, type TreatmentProgress } from "@/lib/treatment-plans/constants"
import { getPatientTreatmentPlans, type TreatmentPlanDetail } from "@/lib/treatment-plans/queries"

const PATIENT_SEARCH_LIMIT = 5

// ---------------------------------------------------------------------------
// Tool 1/2 — today's / upcoming appointments. Never carries financial data,
// so no permission gating: thin reshapes of the existing Dashboard queries,
// not a second implementation of the same read.
// ---------------------------------------------------------------------------
export type AIAppointmentSummary = {
  patientName: string
  staffName: string
  startsAt: string
  reason: string | null
  status: AppointmentStatus
}

export async function getTodayAppointmentsForAI(): Promise<AIAppointmentSummary[]> {
  const rows = await getTodaysAppointments()
  return rows.map((row) => ({
    patientName: row.patientName,
    staffName: row.staffName,
    startsAt: row.startsAt,
    reason: row.reason,
    status: row.status,
  }))
}

export async function getUpcomingAppointmentsForAI(): Promise<AIAppointmentSummary[]> {
  const rows = await getUpcomingAppointments()
  return rows.map((row) => ({
    patientName: row.patientName,
    staffName: row.staffName,
    startsAt: row.startsAt,
    reason: row.reason,
    status: row.status,
  }))
}

// ---------------------------------------------------------------------------
// Patient name resolution — the model gets a patient's name from the
// conversation, never an id, so `getPatientSummary`/`getTreatmentPlanStatus` accept
// a name and resolve it here (clinic-scoped via RLS, soft-deleted excluded).
// ---------------------------------------------------------------------------
export type PatientNameMatch = { id: string; fullName: string }

export async function searchPatientsByName(name: string): Promise<PatientNameMatch[]> {
  const term = sanitizeSearchTerm(name)
  if (!term) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name")
    .is("deleted_at", null)
    .ilike("full_name", `%${term}%`)
    .order("full_name")
    .limit(PATIENT_SEARCH_LIMIT)

  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }))
}

// ---------------------------------------------------------------------------
// Tools 3/4 — a patient's treatment picture, read from the treatment plan
// model (2026-10-14; the legacy package/series tables are no longer read).
// The narrative summary itself is `summarizePatientTreatments` — the same
// function behind the patient card's AI box.
// ---------------------------------------------------------------------------
async function getPatientVisitsForAI(patientId: string) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const [{ data: upcoming, error: upcomingError }, { data: last, error: lastError }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id")
      .eq("patient_id", patientId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gt("starts_at", nowIso)
      .limit(1),
    supabase
      .from("appointments")
      .select("starts_at")
      .eq("patient_id", patientId)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,no_show)")
      .lte("starts_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1),
  ])
  if (upcomingError) throw upcomingError
  if (lastError) throw lastError
  return { hasUpcomingAppointment: (upcoming ?? []).length > 0, lastAppointmentAt: last?.[0]?.starts_at ?? null }
}

export type AIPatientSummary = PatientTreatmentSummary & {
  fullName: string
  hasUpcomingAppointment: boolean
  /** Per-currency remaining balance — `null` when the caller lacks `financial_access`, never a `0` standing in for "withheld." */
  remainingBalances: { currency: string; remaining: number }[] | null
}

export async function getPatientSummaryForAI(
  patient: PatientNameMatch,
  hasFinancialAccess: boolean,
): Promise<AIPatientSummary> {
  const [plans, visits] = await Promise.all([getPatientTreatmentPlans(patient.id), getPatientVisitsForAI(patient.id)])
  const livePlans = plans.filter((plan) => plan.status !== "voided")

  return {
    fullName: patient.fullName,
    hasUpcomingAppointment: visits.hasUpcomingAppointment,
    ...summarizePatientTreatments(plans, visits),
    remainingBalances: hasFinancialAccess ? sumRemainingByCurrency(livePlans) : null,
  }
}

function sumRemainingByCurrency(plans: TreatmentPlanDetail[]): { currency: string; remaining: number }[] {
  const totals = new Map<string, number>()
  for (const plan of plans) {
    for (const entry of plan.currencyTotals) {
      totals.set(entry.currency, (totals.get(entry.currency) ?? 0) + (entry.remaining ?? 0))
    }
  }
  return Array.from(totals, ([currency, remaining]) => ({ currency, remaining }))
}

export type AIPatientTreatmentPlans = {
  fullName: string
  plans: {
    planName: string
    progress: TreatmentProgress
    createdAt: string
    items: {
      treatmentName: string
      providerName: string
      progress: TreatmentProgress
      toothNumbers: number[]
      completedToothNumbers: number[]
      /** `null` when the caller lacks `financial_access`. */
      price: { amount: number | null; currency: string } | null
    }[]
  }[]
}

export async function getPatientTreatmentPlansForAI(
  patient: PatientNameMatch,
  hasFinancialAccess: boolean,
): Promise<AIPatientTreatmentPlans> {
  const plans = await getPatientTreatmentPlans(patient.id)
  return {
    fullName: patient.fullName,
    plans: plans
      .filter((plan) => plan.status !== "voided")
      .map((plan) => ({
        planName: plan.planName,
        progress: derivePlanProgress(plan),
        createdAt: plan.createdAt,
        items: plan.items.map((item) => ({
          treatmentName: item.treatmentName,
          providerName: item.providerName,
          progress: deriveItemProgress(item),
          toothNumbers: item.toothNumbers,
          completedToothNumbers: item.completedToothNumbers,
          price: hasFinancialAccess ? { amount: item.totalPrice, currency: item.currency } : null,
        })),
      })),
  }
}

/** Clinic-wide, counts only — safe for every role. */
export async function getActiveTreatmentPlanCountForAI(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("treatment_plans")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .is("deleted_at", null)
  if (error) throw error
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Tool 5 — getNewPatientStats. Founder's spec buckets this under "Owner"
// only (not in the Staff context list) — gated the same way every other
// financial-adjacent aggregate in this app is, on the `financial_access`
// permission (not a raw `role === 'owner'` check), per the standing
// "financial visibility must not be implied by role" principle
// (docs/ARCHITECTURE.md). Counts, not amounts, but kept behind the same gate
// the founder asked for.
// ---------------------------------------------------------------------------
export async function getNewPatientStatsForAI(hasFinancialAccess: boolean): Promise<number | null> {
  if (!hasFinancialAccess) return null

  const supabase = await createClient()
  const { count, error } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("created_at", startOfMonthISOString())

  if (error) throw error
  return count ?? 0
}

export async function getNoShowCountForAI(hasFinancialAccess: boolean): Promise<number | null> {
  if (!hasFinancialAccess) return null

  const supabase = await createClient()
  const { count, error } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "no_show")
    .gte("starts_at", startOfMonthISOString())

  if (error) throw error
  return count ?? 0
}

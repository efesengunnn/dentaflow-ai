import {
  FOLLOW_UP_RULES,
  INACTIVE_PATIENT_THRESHOLD_DAYS,
  PACKAGE_ENDING_SESSIONS_REMAINING,
  type FollowUpRuleKey,
} from "@/lib/ai/constants"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { getTodaysAppointments, getUpcomingAppointments, startOfMonthISOString } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import { sanitizeSearchTerm } from "@/lib/supabase/query-helpers"
import type { TreatmentLifecycleStatus } from "@/lib/treatments/constants"
import { getTreatmentSeriesForPatient } from "@/lib/treatments/queries"

const PATIENT_SEARCH_LIMIT = 5

function daysBetween(isoDate: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

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
// conversation, never an id, so `getPatientSummary`/`getPackageStatus` accept
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
// Tool 3 — getPatientSummary
// ---------------------------------------------------------------------------
export type AIPatientSummary = {
  patientId: string
  fullName: string
  lastSessionDate: string | null
  lastSessionType: string | null
  /** Doctor-entered `treatments.control_date` for the last session, when set. */
  nextControlDate: string | null
  activeSeriesCount: number
  totalRemainingSessions: number
  /** `null` when the caller lacks `financial_access` — never a `0` standing in for "withheld." */
  totalRemainingBalance: number | null
}

export async function getPatientSummaryForAI(
  patientId: string,
  hasFinancialAccess: boolean,
): Promise<AIPatientSummary | null> {
  const supabase = await createClient()

  const [{ data: patientRow, error: patientError }, seriesRows] = await Promise.all([
    supabase.from("patients").select("id, full_name").is("deleted_at", null).eq("id", patientId).maybeSingle(),
    getTreatmentSeriesForPatient(patientId),
  ])
  if (patientError) throw patientError
  if (!patientRow) return null

  const seriesById = new Map(seriesRows.map((row) => [row.id, row]))
  const seriesIds = seriesRows.map((row) => row.id)

  let lastSessionDate: string | null = null
  let lastSessionType: string | null = null
  let nextControlDate: string | null = null

  if (seriesIds.length > 0) {
    const { data: sessionRows, error: sessionError } = await supabase
      .from("treatments")
      .select("series_id, treatment_date, control_date")
      .in("series_id", seriesIds)
      .eq("status", "completed")
      .order("treatment_date", { ascending: false })
      .limit(1)
    if (sessionError) throw sessionError

    const lastSession = sessionRows?.[0]
    if (lastSession) {
      lastSessionDate = lastSession.treatment_date
      nextControlDate = lastSession.control_date
      lastSessionType = seriesById.get(lastSession.series_id)?.treatmentType ?? null
    }
  }

  const activeSeries = seriesRows.filter((row) => row.status === "active")

  return {
    patientId: patientRow.id,
    fullName: patientRow.full_name,
    lastSessionDate,
    lastSessionType,
    nextControlDate,
    activeSeriesCount: activeSeries.length,
    totalRemainingSessions: activeSeries.reduce((sum, row) => sum + row.remainingSessions, 0),
    totalRemainingBalance: hasFinancialAccess
      ? activeSeries.reduce((sum, row) => sum + (row.remainingBalance ?? 0), 0)
      : null,
  }
}

// ---------------------------------------------------------------------------
// Tool 4 — getPackageStatus: clinic-wide summary (no patient named) or one
// patient's package detail (patient named). Clinic-wide summary is counts
// only — never financial, safe for every role unconditionally, matching
// "Paket durumu" appearing in both the Owner and Staff context lists.
// ---------------------------------------------------------------------------
export type AIClinicPackageStatus = {
  activePackageCount: number
  endingSoonCount: number
}

export async function getClinicPackageStatusForAI(): Promise<AIClinicPackageStatus> {
  const supabase = await createClient()

  const { data: seriesRows, error: seriesError } = await supabase
    .from("treatment_series")
    .select("id, total_sessions, patients!inner(deleted_at)")
    .eq("status", "active")
    .is("patients.deleted_at", null)
  if (seriesError) throw seriesError

  const activeSeries = seriesRows ?? []
  const seriesIds = activeSeries.map((row) => row.id)

  const { data: treatmentRows, error: treatmentError } =
    seriesIds.length > 0
      ? await supabase.from("treatments").select("series_id, status").in("series_id", seriesIds)
      : { data: [] as { series_id: string; status: TreatmentLifecycleStatus }[], error: null }
  if (treatmentError) throw treatmentError

  const completedBySeriesId = new Map<string, number>()
  for (const row of treatmentRows ?? []) {
    if (row.status !== "completed") continue
    completedBySeriesId.set(row.series_id, (completedBySeriesId.get(row.series_id) ?? 0) + 1)
  }

  const endingSoonCount = activeSeries.filter((row) => {
    const completed = completedBySeriesId.get(row.id) ?? 0
    return Math.max(row.total_sessions - completed, 0) === PACKAGE_ENDING_SESSIONS_REMAINING
  }).length

  return { activePackageCount: activeSeries.length, endingSoonCount }
}

export type AIPatientPackageStatus = {
  patientId: string
  fullName: string
  series: {
    treatmentType: string
    totalSessions: number
    completedSessions: number
    remainingSessions: number
    remainingBalance: number | null
    status: TreatmentLifecycleStatus
  }[]
}

export async function getPatientPackageStatusForAI(
  patientId: string,
  hasFinancialAccess: boolean,
): Promise<AIPatientPackageStatus | null> {
  const supabase = await createClient()
  const { data: patientRow, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name")
    .is("deleted_at", null)
    .eq("id", patientId)
    .maybeSingle()
  if (patientError) throw patientError
  if (!patientRow) return null

  const seriesRows = await getTreatmentSeriesForPatient(patientId)

  return {
    patientId: patientRow.id,
    fullName: patientRow.full_name,
    series: seriesRows
      .filter((row) => row.status !== "voided")
      .map((row) => ({
        treatmentType: row.treatmentType,
        totalSessions: row.totalSessions,
        completedSessions: row.completedSessions,
        remainingSessions: row.remainingSessions,
        remainingBalance: hasFinancialAccess ? row.remainingBalance : null,
        status: row.status,
      })),
  }
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

// ---------------------------------------------------------------------------
// Tool 6 — getFollowUpCandidates. One clinic-wide query for the whole range
// (treatment_series + their completed sessions), reshaped in JS — same "one
// query, not a per-patient round trip" discipline as the rest of the
// Treatment module. Feeds both the chat tool and the deterministic Dashboard
// "AI Uyarıları" card / Patient Detail box (no LLM call needed for either,
// see docs/ARCHITECTURE.md's AI Usage Policy).
// ---------------------------------------------------------------------------
export type AIFollowUpCandidate = {
  patientId: string
  fullName: string
  lastSessionDate: string
  daysSinceLastSession: number
}

export type AIPackageEndingSoonCandidate = {
  patientId: string
  fullName: string
  treatmentType: string
  remainingSessions: number
}

export type AIFollowUpCandidates = {
  byRule: Record<FollowUpRuleKey, AIFollowUpCandidate[]>
  packageEndingSoon: AIPackageEndingSoonCandidate[]
  inactivePatients: AIFollowUpCandidate[]
}

export async function getFollowUpCandidatesForAI(): Promise<AIFollowUpCandidates> {
  const supabase = await createClient()

  const { data: seriesRows, error: seriesError } = await supabase
    .from("treatment_series")
    .select("id, patient_id, treatment_type, total_sessions, status, patients!inner(full_name, deleted_at)")
    .neq("status", "voided")
    .is("patients.deleted_at", null)
  if (seriesError) throw seriesError

  const series = seriesRows ?? []
  const seriesIds = series.map((row) => row.id)

  const { data: sessionRows, error: sessionError } =
    seriesIds.length > 0
      ? await supabase
          .from("treatments")
          .select("series_id, treatment_date, control_date")
          .in("series_id", seriesIds)
          .eq("status", "completed")
      : { data: [] as { series_id: string; treatment_date: string; control_date: string | null }[], error: null }
  if (sessionError) throw sessionError

  const completedCountBySeriesId = new Map<string, number>()
  const latestSessionBySeriesId = new Map<string, { treatmentDate: string; controlDate: string | null }>()
  for (const row of sessionRows ?? []) {
    completedCountBySeriesId.set(row.series_id, (completedCountBySeriesId.get(row.series_id) ?? 0) + 1)
    const existing = latestSessionBySeriesId.get(row.series_id)
    if (!existing || row.treatment_date > existing.treatmentDate) {
      latestSessionBySeriesId.set(row.series_id, { treatmentDate: row.treatment_date, controlDate: row.control_date })
    }
  }

  const now = new Date()
  const byRule = Object.fromEntries(FOLLOW_UP_RULES.map((rule) => [rule.key, [] as AIFollowUpCandidate[]])) as Record<
    FollowUpRuleKey,
    AIFollowUpCandidate[]
  >
  const packageEndingSoon: AIPackageEndingSoonCandidate[] = []
  const latestOverallByPatientId = new Map<string, { fullName: string; date: string }>()

  for (const row of series) {
    const patientId = row.patient_id
    const fullName = row.patients?.full_name ?? "Bilinmeyen Hasta"
    const lastSession = latestSessionBySeriesId.get(row.id)

    if (lastSession) {
      const existingOverall = latestOverallByPatientId.get(patientId)
      if (!existingOverall || lastSession.treatmentDate > existingOverall.date) {
        latestOverallByPatientId.set(patientId, { fullName, date: lastSession.treatmentDate })
      }

      const treatmentTypeLower = row.treatment_type.toLocaleLowerCase("tr")
      const matchedRule = FOLLOW_UP_RULES.find((rule) =>
        rule.keywords.some((keyword) => treatmentTypeLower.includes(keyword)),
      )
      if (matchedRule) {
        const dueDate = lastSession.controlDate ?? addDays(lastSession.treatmentDate, matchedRule.intervalDays)
        if (new Date(dueDate) <= now) {
          byRule[matchedRule.key].push({
            patientId,
            fullName,
            lastSessionDate: lastSession.treatmentDate,
            daysSinceLastSession: daysBetween(lastSession.treatmentDate, now),
          })
        }
      }
    }

    if (row.status === "active") {
      const completed = completedCountBySeriesId.get(row.id) ?? 0
      const remaining = Math.max(row.total_sessions - completed, 0)
      if (remaining === PACKAGE_ENDING_SESSIONS_REMAINING) {
        packageEndingSoon.push({ patientId, fullName, treatmentType: row.treatment_type, remainingSessions: remaining })
      }
    }
  }

  const inactivePatients = Array.from(latestOverallByPatientId.entries())
    .map(([patientId, value]) => ({
      patientId,
      fullName: value.fullName,
      lastSessionDate: value.date,
      daysSinceLastSession: daysBetween(value.date, now),
    }))
    .filter((row) => row.daysSinceLastSession >= INACTIVE_PATIENT_THRESHOLD_DAYS)

  return { byRule, packageEndingSoon, inactivePatients }
}

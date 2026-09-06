import type { AppointmentStatus } from "@/lib/appointments/constants"
import type { AppointmentLinkedTreatment } from "@/lib/appointments/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { startOfMonthIstanbul, startOfTodayIstanbul } from "@/lib/format/date"
import { currentStaffHasPermission } from "@/lib/permissions/queries"
import { createClient } from "@/lib/supabase/server"
import type { TreatmentLifecycleStatus, TreatmentPaymentEntryType, TreatmentPaymentMethod } from "@/lib/treatments/constants"
import {
  deriveRemainingBalance,
  getSeriesRemainingBalances,
  paymentLedgerSign,
  resolvePrimaryStaffBySeries,
  sumPaymentLedger,
} from "@/lib/treatments/queries"

const RECENT_LIMIT = 5
const ACTIVITY_FEED_LIMIT = 8
const FINANCIAL_STAFF_REVENUE_LIMIT = 5

/**
 * Exported: also used by `lib/ai/queries.ts` (Sprint 27) for the same "this
 * month" scoping. Uses Istanbul wall-clock time explicitly — `new
 * Date(now.getFullYear(), now.getMonth(), 1)` would use the server
 * process's own timezone (UTC on Vercel), which can be wrong not just by
 * hours but by an entire calendar day/month near midnight Istanbul time.
 */
export function startOfMonthISOString(): string {
  return startOfMonthIstanbul().toISOString()
}

export type DashboardActivityRow = {
  id: string
  entity: "lead" | "patient"
  entityId: string
  description: string
  createdAt: string
  authorName: string | null
}

/**
 * `patient_activities` only as of Sprint 8.5 — previously merged in
 * `lead_activities` too, dropped along with the Lead-facing Dashboard cards
 * (Lead Management is no longer part of DentaFlow Core; see
 * `docs/CHANGELOG.md`'s Sprint 8.5 entry). `entity` keeps its `"lead" |
 * "patient"` type (not narrowed to just `"patient"`) so `DashboardActivityFeed`
 * — unchanged, still handles both — stays correct without an edit; this
 * function now simply never produces a `"lead"` row.
 */
export async function getRecentActivities(): Promise<DashboardActivityRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("patient_activities")
    .select(
      "id, patient_id, description, created_at, author:staff_members!patient_activities_created_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(ACTIVITY_FEED_LIMIT)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    entity: "patient" as const,
    entityId: row.patient_id,
    description: row.description,
    createdAt: row.created_at,
    authorName: row.author?.full_name ?? null,
  }))
}

export type DashboardAppointmentRow = {
  id: string
  patientId: string
  staffId: string
  patientName: string
  staffName: string
  startsAt: string
  endsAt: string
  reason: string | null
  status: AppointmentStatus
  /**
   * Non-null only when this appointment already has a not-yet-completed
   * session attached (Sprint 13's "+ Tedavi Tanımla") — feeds the "Seansı da
   * tamamlamak ister misiniz?" quick action (Sprint 15) and, since Sprint 18,
   * the "Paket adı / N. Seans" + "Tahsilat Bekliyor" card info. Same shape as
   * `lib/appointments/queries.ts`'s `AppointmentLinkedTreatment`, reused
   * directly since "Bugünkü Randevular" now feeds both the Dashboard and
   * Randevular > Bugün via the same `TodaysAppointmentsCard`.
   */
  linkedTreatment: AppointmentLinkedTreatment | null
}

const DASHBOARD_APPOINTMENT_SELECT =
  "id, patient_id, staff_id, starts_at, ends_at, reason, status, patient:patients!appointments_patient_id_fkey(full_name), provider:staff_members!appointments_staff_id_fkey(full_name), treatments!treatments_appointment_id_fkey(series_id, session_number, status, series:treatment_series(treatment_type, total_sessions))"

type RawDashboardAppointmentRow = {
  id: string
  patient_id: string
  staff_id: string
  starts_at: string
  ends_at: string
  reason: string | null
  status: AppointmentStatus
  patient: { full_name: string } | null
  provider: { full_name: string } | null
  treatments: {
    series_id: string
    session_number: number
    status: TreatmentLifecycleStatus
    series: { treatment_type: string; total_sessions: number } | null
  }[] | null
}

/** Not filtered to `status === "active"` — see the matching comment in `lib/appointments/queries.ts`'s `findLinkedTreatment`; only `voided` is excluded. */
function findLinkedTreatment(row: RawDashboardAppointmentRow) {
  return (row.treatments ?? []).find((treatment) => treatment.status !== "voided")
}

function activeLinkedTreatmentSeriesId(row: RawDashboardAppointmentRow): string | null {
  return findLinkedTreatment(row)?.series_id ?? null
}

function mapDashboardAppointmentRow(
  row: RawDashboardAppointmentRow,
  remainingBalanceBySeriesId: Map<string, number | null> = new Map(),
): DashboardAppointmentRow {
  const linked = findLinkedTreatment(row)
  const linkedTreatment: AppointmentLinkedTreatment | null = linked
    ? {
        seriesId: linked.series_id,
        treatmentType: linked.series?.treatment_type ?? "",
        sessionNumber: linked.session_number,
        totalSessions: linked.series?.total_sessions ?? 1,
        remainingBalance: remainingBalanceBySeriesId.get(linked.series_id) ?? null,
        sessionStatus: linked.status,
      }
    : null

  return {
    id: row.id,
    patientId: row.patient_id,
    staffId: row.staff_id,
    patientName: row.patient?.full_name ?? "",
    staffName: row.provider?.full_name ?? "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    status: row.status,
    linkedTreatment,
  }
}

/**
 * "Bugünkü Randevular" — business rule (founder-confirmed, Sprint 6
 * planning): `starts_at` falls within today's local calendar day, and
 * `status != 'cancelled'` (a cancelled slot is no longer part of today's
 * actual schedule, same reasoning as the calendar/list views excluding it
 * from overlap checks). Ordered soonest-first.
 */
export async function getTodaysAppointments(): Promise<DashboardAppointmentRow[]> {
  const supabase = await createClient()
  // Istanbul wall-clock, not the server process's own timezone — see
  // startOfMonthISOString above for why this matters on Vercel.
  const todayStart = startOfTodayIstanbul()
  const startOfToday = todayStart.toISOString()
  const startOfTomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("appointments")
    .select(DASHBOARD_APPOINTMENT_SELECT)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .gte("starts_at", startOfToday)
    .lt("starts_at", startOfTomorrow)
    .order("starts_at", { ascending: true })

  if (error) throw error

  const rows = data ?? []
  const seriesIds = rows.map(activeLinkedTreatmentSeriesId).filter((id): id is string => id !== null)
  const balances = await getSeriesRemainingBalances(seriesIds)

  return rows.map((row) => mapDashboardAppointmentRow(row, balances))
}

/**
 * "Yaklaşan Randevular" — business rule (founder-confirmed, Sprint 6
 * planning): `starts_at > now()`, `status != 'cancelled'`, first 5 rows
 * ordered soonest-first. Deliberately not "today's remaining + tomorrow" —
 * a plain `> now()` cutoff is simpler and matches what "upcoming" means on
 * every other list in this app (Recent Leads/Patients use the same
 * soonest/latest-first + fixed cap shape).
 */
export async function getUpcomingAppointments(): Promise<DashboardAppointmentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(DASHBOARD_APPOINTMENT_SELECT)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(RECENT_LIMIT)

  if (error) throw error
  return (data ?? []).map((row) => mapDashboardAppointmentRow(row))
}

// ---------------------------------------------------------------------------
// Dashboard financial visibility (Sprint 7, consolidated Sprint 9) — Tier 3
// (clinic-wide) of docs/DATABASE.md's three-tier model. Kept in this file,
// not a new module, since these are Dashboard-shaped aggregates (same
// "reshape/sum in JS from a handful of batched queries" discipline as the
// rest of this file), not a treatment-module concern.
//
// `getFinancialSummary`/`getMonthlyRevenueDetail`/`getOutstandingBalanceDetail`
// (Sprint 7/8.5) each independently re-fetched `treatment_series` +
// `treatments` + `treatment_payments` — three near-identical query triples on
// every Dashboard load for a `financial_access` holder. Sprint 9 merges them
// into one fetch, `getFinancialOverview()`, that derives every shape
// (headline aggregates, the revenue drill-down rows, the outstanding-balance
// drill-down rows) from the same in-memory dataset — same total data read,
// a third of the round trips.
// ---------------------------------------------------------------------------

export type StaffRevenueRow = {
  staffId: string
  staffName: string
  amount: number
}

export type MonthlyRevenueDetailRow = {
  id: string
  /** Founder decision 2026-07-28 — needed to open a correction from this row directly, no navigation to the treatment's own card. */
  seriesId: string
  method: TreatmentPaymentMethod
  patientId: string
  patientName: string
  treatmentType: string
  staffId: string | null
  staffName: string | null
  amount: number
  entryType: TreatmentPaymentEntryType
  paidAt: string
}

export type OutstandingBalanceDetailRow = {
  seriesId: string
  patientId: string
  patientName: string
  treatmentType: string
  totalFee: number | null
  paidAmount: number
  remainingBalance: number
  lastPaymentDate: string | null
  staffId: string | null
  staffName: string | null
}

export type FinancialOverview = {
  monthlyRevenue: number
  outstandingBalance: number
  staffRevenue: StaffRevenueRow[]
  /** All-time, unbounded — feeds the "Bu Ay Toplam Ciro" drill-down, which defaults its own date filter to this month but can widen. */
  revenueDetail: MonthlyRevenueDetailRow[]
  /** Only series with a real (>0) remaining balance — feeds the "Bekleyen Bakiye" drill-down. */
  outstandingBalanceDetail: OutstandingBalanceDetailRow[]
}

/**
 * Tier 3 — clinic-wide financial (docs/DATABASE.md#three-tier-financial-visibility).
 * Checks `financial_access` itself, not just at the call site: this makes
 * the function the "permission-checked service layer" the AI Data Access
 * Principle (docs/ARCHITECTURE.md) requires once AI calls into financial
 * aggregates — `current_staff_has_permission('financial_access')` stays the
 * single decision point everywhere, never a parallel role check. A
 * successful call also IS "opening the financial-aggregate view," so it
 * logs one `financial_dashboard_view` row to `audit_logs`
 * (docs/DATABASE.md#audit_logs) — fire-and-forget, a logging failure must
 * never block the Dashboard from rendering.
 *
 * Personnel revenue attribution joins through `treatments.staff_id`, never
 * `treatment_payments.recorded_by` (front-desk staff who took the payment
 * vs. the staff who generated the revenue are different questions — see the
 * `treatment_payments` table comment in
 * `20260724090000_create_treatment_module.sql`). A package series can span
 * multiple staff across its sessions; each series' revenue is credited to
 * whichever staff member performed the most sessions in it — the common
 * case is one treating staff per series throughout, and this avoids
 * fractional-revenue splitting for the rare multi-staff series.
 *
 * `outstandingBalance` (the headline figure) stays a simple clinic-wide net
 * — `sum(total_fee) - sum(all-time paid)` — deliberately not a sum of only
 * the positive per-series balances in `outstandingBalanceDetail`; an
 * overpaid series nets against an underpaid one in the headline number,
 * same math as Sprint 7/8.5's `getFinancialSummary`, preserved as-is here.
 * The payments fetch is intentionally unbounded (no date floor, no row
 * limit): capping it would silently under-count `paidAmount` for any series
 * with payment history older than the cutoff, corrupting a real financial
 * total — not an acceptable tradeoff for a performance shortcut. Bounded
 * instead by what it actually is: a single pilot clinic's lifetime ledger,
 * realistically hundreds of rows at MVP scale, not the kind of table that
 * needs pagination yet.
 */
export async function getFinancialOverview(): Promise<FinancialOverview | null> {
  const hasAccess = await currentStaffHasPermission("financial_access")
  if (!hasAccess) return null

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  const supabase = await createClient()
  const monthStart = startOfMonthISOString()

  const [
    { data: seriesRows, error: seriesError },
    { error: auditError },
  ] = await Promise.all([
    supabase
      .from("treatment_series")
      .select("id, treatment_type, total_fee, patient:patients!treatment_series_patient_id_fkey(id, full_name)")
      .neq("status", "voided"),
    // Awaited alongside the reads (not fire-and-forget): an un-awaited
    // insert can be dropped once the Server Component's render promise
    // resolves and the request lifecycle tears down, so it must be part of
    // what this function actually waits on. A logging failure still must
    // never block the Dashboard from rendering, so its error is swallowed.
    supabase.from("audit_logs").insert({
      clinic_id: staffMember.clinicId,
      staff_id: staffMember.userId,
      event_type: "financial_dashboard_view",
    }),
  ])

  if (seriesError) throw seriesError
  if (auditError) console.error("financial_dashboard_view audit log insert failed:", auditError)
  if (!seriesRows || seriesRows.length === 0) {
    return { monthlyRevenue: 0, outstandingBalance: 0, staffRevenue: [], revenueDetail: [], outstandingBalanceDetail: [] }
  }

  const seriesIds = seriesRows.map((row) => row.id)
  const seriesById = new Map(seriesRows.map((row) => [row.id, row]))

  const [{ data: treatmentRows, error: treatmentError }, { data: paymentRows, error: paymentError }] =
    await Promise.all([
      supabase
        .from("treatments")
        .select("series_id, staff_id, staff:staff_members!treatments_staff_id_fkey(full_name)")
        .in("series_id", seriesIds)
        .neq("status", "voided"),
      supabase
        .from("treatment_payments")
        .select("id, series_id, amount, entry_type, method, paid_at")
        .in("series_id", seriesIds)
        .order("paid_at", { ascending: false }),
    ])

  if (treatmentError) throw treatmentError
  if (paymentError) throw paymentError

  const payments = paymentRows ?? []
  const primaryStaffBySeriesId = resolvePrimaryStaffBySeries(
    (treatmentRows ?? []).map((row) => ({
      seriesId: row.series_id,
      staffId: row.staff_id,
      staffName: row.staff?.full_name ?? "",
    })),
  )

  // --- Headline aggregates -------------------------------------------------
  // A series with no fee yet ("Ücret Belirlenmedi", Sprint 8) contributes 0
  // here — its real fee isn't known yet, so it can't be counted as expected
  // revenue until someone sets it; it'll be included automatically once they do.
  const totalFee = seriesRows.reduce((sum, row) => sum + (row.total_fee ?? 0), 0)
  const allTimePaid = sumPaymentLedger(payments.map((row) => ({ amount: row.amount, entryType: row.entry_type })))
  const monthlyPayments = payments.filter((row) => row.paid_at >= monthStart)
  const monthlyRevenue = sumPaymentLedger(
    monthlyPayments.map((row) => ({ amount: row.amount, entryType: row.entry_type })),
  )

  const staffAmounts = new Map<string, StaffRevenueRow>()
  for (const row of monthlyPayments) {
    // `series_id` is guaranteed non-null here (queried via `.in("series_id", seriesIds)`
    // above) — the column itself became nullable in Sprint 28 to also allow
    // `treatment_plan_id`-attached rows, which this legacy series-only query never fetches.
    const primaryStaff = primaryStaffBySeriesId.get(row.series_id!)
    if (!primaryStaff) continue
    const existing = staffAmounts.get(primaryStaff.staffId) ?? {
      staffId: primaryStaff.staffId,
      staffName: primaryStaff.staffName,
      amount: 0,
    }
    existing.amount += paymentLedgerSign(row.entry_type) * row.amount
    staffAmounts.set(primaryStaff.staffId, existing)
  }
  const staffRevenue = Array.from(staffAmounts.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, FINANCIAL_STAFF_REVENUE_LIMIT)

  // --- Revenue drill-down rows (Sprint 8.5, all-time) -----------------------
  const revenueDetail: MonthlyRevenueDetailRow[] = payments.map((row) => {
    const series = seriesById.get(row.series_id!)
    const primaryStaff = primaryStaffBySeriesId.get(row.series_id!)
    return {
      id: row.id,
      seriesId: row.series_id!,
      method: row.method,
      patientId: series?.patient?.id ?? "",
      patientName: series?.patient?.full_name ?? "",
      treatmentType: series?.treatment_type ?? "",
      staffId: primaryStaff?.staffId ?? null,
      staffName: primaryStaff?.staffName ?? null,
      amount: row.amount,
      entryType: row.entry_type,
      paidAt: row.paid_at,
    }
  })

  // --- Outstanding balance drill-down rows (Sprint 8.5) ---------------------
  const paymentsBySeriesId = new Map<
    string,
    { amount: number; entryType: TreatmentPaymentEntryType; paidAt: string }[]
  >()
  for (const row of payments) {
    const list = paymentsBySeriesId.get(row.series_id!) ?? []
    list.push({ amount: row.amount, entryType: row.entry_type, paidAt: row.paid_at })
    paymentsBySeriesId.set(row.series_id!, list)
  }

  const outstandingBalanceDetail: OutstandingBalanceDetailRow[] = []
  for (const row of seriesRows) {
    const seriesPayments = paymentsBySeriesId.get(row.id) ?? []
    const paidAmount = sumPaymentLedger(seriesPayments)
    const remainingBalance = deriveRemainingBalance(row.total_fee, paidAmount)
    if (remainingBalance === null || remainingBalance <= 0) continue

    const lastPaymentDate = seriesPayments.reduce<string | null>(
      (latest, payment) => (!latest || payment.paidAt > latest ? payment.paidAt : latest),
      null,
    )
    const primaryStaff = primaryStaffBySeriesId.get(row.id)

    outstandingBalanceDetail.push({
      seriesId: row.id,
      patientId: row.patient?.id ?? "",
      patientName: row.patient?.full_name ?? "",
      treatmentType: row.treatment_type,
      totalFee: row.total_fee,
      paidAmount,
      remainingBalance,
      lastPaymentDate,
      staffId: primaryStaff?.staffId ?? null,
      staffName: primaryStaff?.staffName ?? null,
    })
  }
  outstandingBalanceDetail.sort((a, b) => b.remainingBalance - a.remainingBalance)

  return {
    monthlyRevenue,
    outstandingBalance: totalFee - allTimePaid,
    staffRevenue,
    revenueDetail,
    outstandingBalanceDetail,
  }
}

export type OwnOperationalStats = {
  label: string
  value: number
}

/**
 * Tier 2 — "my own operational stats," unconditional, no permission check
 * (docs/DATABASE.md#three-tier-financial-visibility): a session count for
 * treating staff, a payments-recorded count for front-desk staff. Always a
 * count, never an amount — an amount would leak Tier 3 (clinic-wide
 * financial) through the back door for staff without `financial_access`.
 * `owner` isn't handled here since an Owner always holds `financial_access`
 * (auto-granted) and sees `getFinancialOverview()`'s Tier 3 content instead —
 * this function is only ever reached for the non-financial_access branch.
 */
export async function getOwnOperationalStats(): Promise<OwnOperationalStats | null> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  const supabase = await createClient()
  const monthStart = startOfMonthISOString()

  if (staffMember.role === "doctor" || staffMember.role === "beauty_specialist") {
    const { count, error } = await supabase
      .from("treatments")
      .select("*", { count: "exact", head: true })
      .eq("staff_id", staffMember.userId)
      .eq("status", "completed")
      .gte("treatment_date", monthStart)

    if (error) throw error
    return { label: "Bu Ay Tamamladığım Seans", value: count ?? 0 }
  }

  if (staffMember.role === "secretary") {
    const { count, error } = await supabase
      .from("treatment_payments")
      .select("*", { count: "exact", head: true })
      .eq("recorded_by", staffMember.userId)
      .gte("paid_at", monthStart)

    if (error) throw error
    return { label: "Bu Ay Kaydettiğim Ödeme", value: count ?? 0 }
  }

  return null
}


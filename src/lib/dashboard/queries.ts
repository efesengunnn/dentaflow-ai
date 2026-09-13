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

/**
 * One currency's slice of a headline aggregate (Sprint 32). TRY and EUR are
 * never summed together — a plan may mix currencies, and the legacy series
 * model is TRY-only, so both cards show one figure per currency.
 */
export type CurrencyAmount = { currency: string; amount: number }

export type MonthlyRevenueDetailRow = {
  id: string
  /** Which model this payment belongs to — drives which correction Sheet the drill-down opens (Sprint 32). */
  source: "series" | "plan"
  /** Set only when source === "series" — opens the legacy correction Sheet. */
  seriesId: string | null
  /** Set only when source === "plan" — opens the Tedavi Planı detail Sheet. */
  treatmentPlanId: string | null
  method: TreatmentPaymentMethod
  patientId: string
  patientName: string
  treatmentType: string
  staffId: string | null
  staffName: string | null
  amount: number
  /** Sprint 32 — the amount is in this currency; legacy series rows are always TRY. */
  currency: string
  entryType: TreatmentPaymentEntryType
  paidAt: string
}

export type OutstandingBalanceDetailRow = {
  source: "series" | "plan"
  seriesId: string | null
  treatmentPlanId: string | null
  patientId: string
  patientName: string
  treatmentType: string
  totalFee: number | null
  paidAmount: number
  remainingBalance: number
  /** Sprint 32 — a plan can owe in more than one currency, each its own row. */
  currency: string
  lastPaymentDate: string | null
  staffId: string | null
  staffName: string | null
}

export type FinancialOverview = {
  /** Per currency — TRY + EUR are never summed together (Sprint 31/32). */
  monthlyRevenue: CurrencyAmount[]
  /** Per currency, same reasoning. */
  outstandingBalance: CurrencyAmount[]
  /** All-time, unbounded, both models — feeds the "Bu Ay Toplam Ciro" drill-down, which defaults its own date filter to this month but can widen. */
  revenueDetail: MonthlyRevenueDetailRow[]
  /** Only series/plan-currencies with a real (>0) remaining balance — feeds the "Bekleyen Bakiye" drill-down. */
  outstandingBalanceDetail: OutstandingBalanceDetailRow[]
}

/** TRY first, then the rest alphabetically — deterministic display order, matches the ledger's convention. */
function sortByCurrency<T extends { currency: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.currency === "TRY" ? -1 : b.currency === "TRY" ? 1 : a.currency.localeCompare(b.currency),
  )
}

/** Per-currency total from a set of priced items — `null` for a currency only when no item in it has a price set yet ("Belirlenmedi"), mirroring the new model's `deriveTotalAmount`. */
function totalByCurrency(items: { currency: string; totalPrice: number | null }[]): Map<string, number | null> {
  const totals = new Map<string, number | null>()
  for (const item of items) {
    const current = totals.get(item.currency)
    if (item.totalPrice === null) {
      if (current === undefined) totals.set(item.currency, null)
    } else {
      totals.set(item.currency, (current ?? 0) + item.totalPrice)
    }
  }
  return totals
}

/**
 * Tier 3 — clinic-wide financial (docs/DATABASE.md#three-tier-financial-visibility).
 * Checks `financial_access` itself, not just at the call site: this makes
 * the function the "permission-checked service layer" the AI Data Access
 * Principle (docs/ARCHITECTURE.md) requires once AI calls into financial
 * aggregates — `current_staff_has_permission('financial_access')` stays the
 * single decision point everywhere, never a parallel role check. A
 * successful call also IS "opening the financial-aggregate view," so it
 * logs one `financial_dashboard_view` row to `audit_logs`.
 *
 * Sprint 32 — now spans BOTH treatment models: the legacy `treatment_series`
 * (TRY-only, being retired) AND the new `treatment_plans` (which the pilot
 * clinic actually uses today, and which can mix TRY + EUR items). Payments
 * live in one shared `treatment_payments` table, tagged either `series_id`
 * (legacy) or `treatment_plan_id` (new); before this sprint the Dashboard
 * read only the `series_id` slice, so every real payment silently showed as
 * ₺0 on the panel (founder report 2026-09-13). Every headline figure is now
 * per currency — TRY and EUR are never summed together (Sprint 31 rule).
 *
 * Personnel revenue attribution: legacy joins through `treatments.staff_id`
 * (whichever staff performed the most sessions in the series); the new model
 * credits each plan to the provider owning the most items on it. Neither
 * uses `treatment_payments.recorded_by` (who took the payment ≠ who earned
 * the revenue). Payments are fetched unbounded (no date floor) — capping
 * would under-count all-time `paidAmount` and corrupt the balance; a single
 * pilot clinic's lifetime ledger is small enough that this is fine.
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
    { data: planRows, error: planError },
    { error: auditError },
  ] = await Promise.all([
    supabase
      .from("treatment_series")
      .select("id, treatment_type, total_fee, patient:patients!treatment_series_patient_id_fkey(id, full_name)")
      .neq("status", "voided"),
    supabase
      .from("treatment_plans")
      .select("id, plan_name, patient:patients!treatment_plans_patient_id_fkey(id, full_name)")
      .neq("status", "voided")
      .is("deleted_at", null),
    // Awaited alongside the reads (not fire-and-forget): an un-awaited
    // insert can be dropped once the Server Component's render promise
    // resolves and the request lifecycle tears down. A logging failure still
    // must never block the Dashboard from rendering, so its error is swallowed.
    supabase.from("audit_logs").insert({
      clinic_id: staffMember.clinicId,
      staff_id: staffMember.userId,
      event_type: "financial_dashboard_view",
    }),
  ])

  if (seriesError) throw seriesError
  if (planError) throw planError
  if (auditError) console.error("financial_dashboard_view audit log insert failed:", auditError)

  const series = seriesRows ?? []
  const plans = planRows ?? []
  const seriesIds = series.map((row) => row.id)
  const planIds = plans.map((row) => row.id)
  const seriesById = new Map(series.map((row) => [row.id, row]))
  const planById = new Map(plans.map((row) => [row.id, row]))

  const emptyResult: { data: never[]; error: null } = { data: [], error: null }
  const [
    { data: treatmentRows, error: treatmentError },
    { data: planItemRows, error: planItemError },
    { data: seriesPaymentRows, error: seriesPaymentError },
    { data: planPaymentRows, error: planPaymentError },
  ] = await Promise.all([
    seriesIds.length > 0
      ? supabase
          .from("treatments")
          .select("series_id, staff_id, staff:staff_members!treatments_staff_id_fkey(full_name)")
          .in("series_id", seriesIds)
          .neq("status", "voided")
      : Promise.resolve(emptyResult),
    planIds.length > 0
      ? supabase
          .from("treatment_plan_items")
          .select(
            "treatment_plan_id, provider_id, total_price, currency, provider:staff_members!treatment_plan_items_provider_id_fkey(full_name)",
          )
          .in("treatment_plan_id", planIds)
          .neq("status", "voided")
          .is("deleted_at", null)
      : Promise.resolve(emptyResult),
    seriesIds.length > 0
      ? supabase
          .from("treatment_payments")
          .select("id, series_id, amount, entry_type, method, currency, paid_at")
          .in("series_id", seriesIds)
          .order("paid_at", { ascending: false })
      : Promise.resolve(emptyResult),
    planIds.length > 0
      ? supabase
          .from("treatment_payments")
          .select("id, treatment_plan_id, amount, entry_type, method, currency, paid_at")
          .in("treatment_plan_id", planIds)
          .order("paid_at", { ascending: false })
      : Promise.resolve(emptyResult),
  ])

  if (treatmentError) throw treatmentError
  if (planItemError) throw planItemError
  if (seriesPaymentError) throw seriesPaymentError
  if (planPaymentError) throw planPaymentError

  const seriesPayments = seriesPaymentRows ?? []
  const planPayments = planPaymentRows ?? []
  const planItems = planItemRows ?? []

  const primaryStaffBySeriesId = resolvePrimaryStaffBySeries(
    (treatmentRows ?? []).map((row) => ({
      seriesId: row.series_id,
      staffId: row.staff_id,
      staffName: row.staff?.full_name ?? "",
    })),
  )

  // Plan-side attribution — credit each plan to the provider owning the most
  // items on it (ties resolve to the first seen), the new-model analogue of
  // `resolvePrimaryStaffBySeries`. Also index items per plan for currency totals.
  const planItemsByPlanId = new Map<string, typeof planItems>()
  for (const item of planItems) {
    const list = planItemsByPlanId.get(item.treatment_plan_id) ?? []
    list.push(item)
    planItemsByPlanId.set(item.treatment_plan_id, list)
  }
  const primaryProviderByPlanId = new Map<string, { providerId: string; providerName: string }>()
  for (const [planId, items] of planItemsByPlanId) {
    const counts = new Map<string, { name: string; count: number }>()
    for (const item of items) {
      const entry = counts.get(item.provider_id) ?? { name: item.provider?.full_name ?? "", count: 0 }
      entry.count += 1
      counts.set(item.provider_id, entry)
    }
    let best: { providerId: string; providerName: string } | null = null
    let bestCount = -1
    for (const [providerId, entry] of counts) {
      if (entry.count > bestCount) {
        bestCount = entry.count
        best = { providerId, providerName: entry.name }
      }
    }
    if (best) primaryProviderByPlanId.set(planId, best)
  }

  // --- Headline: monthly revenue per currency ------------------------------
  const monthlyByCurrency = new Map<string, number>()
  for (const row of [...seriesPayments, ...planPayments]) {
    if (row.paid_at < monthStart) continue
    const currency = row.currency ?? "TRY"
    monthlyByCurrency.set(currency, (monthlyByCurrency.get(currency) ?? 0) + paymentLedgerSign(row.entry_type) * row.amount)
  }
  const monthlyRevenue = sortByCurrency(
    Array.from(monthlyByCurrency.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .filter((row) => row.amount !== 0),
  )

  // --- Headline: outstanding balance per currency --------------------------
  // Clinic-wide net per currency: sum(total) - sum(all-time paid). An
  // overpaid record nets against an underpaid one within the same currency
  // (same convention as the pre-Sprint-32 headline), never across currencies.
  // A record with no fee yet ("Belirlenmedi") contributes 0 to its total.
  const balanceTotalByCurrency = new Map<string, number>()
  const balancePaidByCurrency = new Map<string, number>()
  const addBalanceTotal = (currency: string, amount: number) =>
    balanceTotalByCurrency.set(currency, (balanceTotalByCurrency.get(currency) ?? 0) + amount)
  const addBalancePaid = (currency: string, sign: number, amount: number) =>
    balancePaidByCurrency.set(currency, (balancePaidByCurrency.get(currency) ?? 0) + sign * amount)

  addBalanceTotal("TRY", series.reduce((sum, row) => sum + (row.total_fee ?? 0), 0))
  for (const row of seriesPayments) addBalancePaid(row.currency ?? "TRY", paymentLedgerSign(row.entry_type), row.amount)
  for (const item of planItems) if (item.total_price !== null) addBalanceTotal(item.currency ?? "TRY", item.total_price)
  for (const row of planPayments) addBalancePaid(row.currency ?? "TRY", paymentLedgerSign(row.entry_type), row.amount)

  const outstandingBalance = sortByCurrency(
    Array.from(new Set([...balanceTotalByCurrency.keys(), ...balancePaidByCurrency.keys()]))
      .map((currency) => ({
        currency,
        amount: (balanceTotalByCurrency.get(currency) ?? 0) - (balancePaidByCurrency.get(currency) ?? 0),
      }))
      .filter((row) => row.amount !== 0),
  )

  // --- Revenue drill-down rows (all-time, both models) ---------------------
  const revenueDetail: MonthlyRevenueDetailRow[] = [
    ...seriesPayments.map((row): MonthlyRevenueDetailRow => {
      const s = seriesById.get(row.series_id!)
      const staff = primaryStaffBySeriesId.get(row.series_id!)
      return {
        id: row.id,
        source: "series",
        seriesId: row.series_id!,
        treatmentPlanId: null,
        method: row.method,
        patientId: s?.patient?.id ?? "",
        patientName: s?.patient?.full_name ?? "",
        treatmentType: s?.treatment_type ?? "",
        staffId: staff?.staffId ?? null,
        staffName: staff?.staffName ?? null,
        amount: row.amount,
        currency: row.currency ?? "TRY",
        entryType: row.entry_type,
        paidAt: row.paid_at,
      }
    }),
    ...planPayments.map((row): MonthlyRevenueDetailRow => {
      const p = planById.get(row.treatment_plan_id!)
      const provider = primaryProviderByPlanId.get(row.treatment_plan_id!)
      return {
        id: row.id,
        source: "plan",
        seriesId: null,
        treatmentPlanId: row.treatment_plan_id!,
        method: row.method,
        patientId: p?.patient?.id ?? "",
        patientName: p?.patient?.full_name ?? "",
        treatmentType: p?.plan_name ?? "",
        staffId: provider?.providerId ?? null,
        staffName: provider?.providerName ?? null,
        amount: row.amount,
        currency: row.currency ?? "TRY",
        entryType: row.entry_type,
        paidAt: row.paid_at,
      }
    }),
  ]

  // --- Outstanding balance drill-down rows ---------------------------------
  const outstandingBalanceDetail: OutstandingBalanceDetailRow[] = []

  // Legacy: one row per series (TRY) with a real remaining balance.
  const seriesPaymentsBySeriesId = new Map<string, { amount: number; entryType: TreatmentPaymentEntryType; paidAt: string }[]>()
  for (const row of seriesPayments) {
    const list = seriesPaymentsBySeriesId.get(row.series_id!) ?? []
    list.push({ amount: row.amount, entryType: row.entry_type, paidAt: row.paid_at })
    seriesPaymentsBySeriesId.set(row.series_id!, list)
  }
  for (const row of series) {
    const pays = seriesPaymentsBySeriesId.get(row.id) ?? []
    const paidAmount = sumPaymentLedger(pays)
    const remainingBalance = deriveRemainingBalance(row.total_fee, paidAmount)
    if (remainingBalance === null || remainingBalance <= 0) continue
    const lastPaymentDate = pays.reduce<string | null>(
      (latest, payment) => (!latest || payment.paidAt > latest ? payment.paidAt : latest),
      null,
    )
    const staff = primaryStaffBySeriesId.get(row.id)
    outstandingBalanceDetail.push({
      source: "series",
      seriesId: row.id,
      treatmentPlanId: null,
      patientId: row.patient?.id ?? "",
      patientName: row.patient?.full_name ?? "",
      treatmentType: row.treatment_type,
      totalFee: row.total_fee,
      paidAmount,
      remainingBalance,
      currency: "TRY",
      lastPaymentDate,
      staffId: staff?.staffId ?? null,
      staffName: staff?.staffName ?? null,
    })
  }

  // New model: one row per (plan, currency) with a real remaining balance.
  const planPaymentsByPlanId = new Map<string, typeof planPayments>()
  for (const row of planPayments) {
    const list = planPaymentsByPlanId.get(row.treatment_plan_id!) ?? []
    list.push(row)
    planPaymentsByPlanId.set(row.treatment_plan_id!, list)
  }
  for (const plan of plans) {
    const items = planItemsByPlanId.get(plan.id) ?? []
    const pays = planPaymentsByPlanId.get(plan.id) ?? []
    const totals = totalByCurrency(items.map((item) => ({ currency: item.currency ?? "TRY", totalPrice: item.total_price })))
    const provider = primaryProviderByPlanId.get(plan.id)
    const currencies = new Set<string>([...totals.keys(), ...pays.map((row) => row.currency ?? "TRY")])
    for (const currency of currencies) {
      const total = totals.get(currency) ?? null
      const currencyPays = pays.filter((row) => (row.currency ?? "TRY") === currency)
      const paidAmount = sumPaymentLedger(currencyPays.map((row) => ({ amount: row.amount, entryType: row.entry_type })))
      const remainingBalance = deriveRemainingBalance(total, paidAmount)
      if (remainingBalance === null || remainingBalance <= 0) continue
      const lastPaymentDate = currencyPays.reduce<string | null>(
        (latest, payment) => (!latest || payment.paid_at > latest ? payment.paid_at : latest),
        null,
      )
      outstandingBalanceDetail.push({
        source: "plan",
        seriesId: null,
        treatmentPlanId: plan.id,
        patientId: plan.patient?.id ?? "",
        patientName: plan.patient?.full_name ?? "",
        treatmentType: plan.plan_name,
        totalFee: total,
        paidAmount,
        remainingBalance,
        currency,
        lastPaymentDate,
        staffId: provider?.providerId ?? null,
        staffName: provider?.providerName ?? null,
      })
    }
  }

  outstandingBalanceDetail.sort((a, b) => b.remainingBalance - a.remainingBalance)

  return {
    monthlyRevenue,
    outstandingBalance,
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


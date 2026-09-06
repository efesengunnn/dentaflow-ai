import { currentStaffHasPermission } from "@/lib/permissions/queries"
import { PATIENT_TREATMENT_SERIES_LIMIT } from "@/lib/treatments/constants"
import type { TreatmentActivityType, TreatmentLifecycleStatus, TreatmentPaymentEntryType, TreatmentPaymentMethod } from "@/lib/treatments/constants"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// treatment_series list — feeds Patient Detail's "Tedaviler" section. One
// query for the series rows, one for their treatments, one for their
// payments — reshaped/summed in JS, same "one query for the whole range"
// discipline as the Calendar (Sprint 6) and Dashboard activity feed
// (Sprint 5), not a per-series round trip.
// ---------------------------------------------------------------------------
export type TreatmentSeriesListRow = {
  id: string
  patientId: string
  treatmentType: string
  totalSessions: number
  completedSessions: number
  remainingSessions: number
  /** `null` — "Ücret Belirlenmedi" (Sprint 8), never a fake `0`. See docs/DATABASE.md. */
  totalFee: number | null
  paidAmount: number
  /** `null` whenever `totalFee` is — an unknown fee has no meaningful balance. */
  remainingBalance: number | null
  currency: string
  status: TreatmentLifecycleStatus
  createdAt: string
}

/** `totalFee - paidAmount`, or `null` when the fee itself is unset ("Belirlenmedi") — a balance can't exist against an unknown fee. Exported: also used by `lib/dashboard/queries.ts`'s Bekleyen Bakiye drill-down (Sprint 8.5). */
export function deriveRemainingBalance(totalFee: number | null, paidAmount: number): number | null {
  return totalFee === null ? null : totalFee - paidAmount
}

/** `payment`/`adjustment` add to the ledger total, `refund`/`void` subtract. Exported: also used by `lib/dashboard/queries.ts` for the same ledger math at clinic-wide scope. */
export function paymentLedgerSign(entryType: TreatmentPaymentEntryType): 1 | -1 {
  return entryType === "refund" || entryType === "void" ? -1 : 1
}

/**
 * "Ödenen Tutar" is `SUM(payment) + SUM(adjustment) - SUM(refund) - SUM(void)`
 * — never stored, always derived from the ledger. See
 * docs/DATABASE.md#treatment-payments--append-only-financial-ledger.
 */
export function sumPaymentLedger(rows: { amount: number; entryType: TreatmentPaymentEntryType }[]): number {
  return rows.reduce((total, row) => total + paymentLedgerSign(row.entryType) * row.amount, 0)
}

/**
 * Personnel attribution for a set of series: whichever staff member
 * performed the most (non-voided) sessions in each series. Joins through
 * `treatments.staff_id`, never `treatment_payments.recorded_by` — see the
 * `treatment_payments` table comment in
 * `20260724090000_create_treatment_module.sql` (front-desk who took the
 * payment vs. the staff who generated the revenue are different questions).
 * A package series can span multiple staff across its sessions; this avoids
 * fractional attribution for the rare multi-staff series. Exported: used by
 * both `lib/dashboard/queries.ts` (Finansal Özet's "Personel Bazında Ciro")
 * and the Treatments Export's "Tedaviyi Yapan Personel" column — the same
 * business rule, not reimplemented per caller.
 */
export function resolvePrimaryStaffBySeries(
  rows: { seriesId: string; staffId: string; staffName: string }[],
): Map<string, { staffId: string; staffName: string }> {
  const sessionCountBySeriesAndStaff = new Map<string, Map<string, { staffName: string; count: number }>>()
  for (const row of rows) {
    const byStaff = sessionCountBySeriesAndStaff.get(row.seriesId) ?? new Map()
    const existing = byStaff.get(row.staffId) ?? { staffName: row.staffName, count: 0 }
    existing.count += 1
    byStaff.set(row.staffId, existing)
    sessionCountBySeriesAndStaff.set(row.seriesId, byStaff)
  }

  const primaryStaffBySeriesId = new Map<string, { staffId: string; staffName: string }>()
  for (const [seriesId, byStaff] of sessionCountBySeriesAndStaff) {
    let best: { staffId: string; staffName: string; count: number } | null = null
    for (const [staffId, value] of byStaff) {
      if (!best || value.count > best.count) best = { staffId, staffName: value.staffName, count: value.count }
    }
    if (best) primaryStaffBySeriesId.set(seriesId, { staffId: best.staffId, staffName: best.staffName })
  }
  return primaryStaffBySeriesId
}

export async function getTreatmentSeriesForPatient(
  patientId: string,
  limit = PATIENT_TREATMENT_SERIES_LIMIT,
): Promise<TreatmentSeriesListRow[]> {
  const supabase = await createClient()

  const { data: seriesRows, error: seriesError } = await supabase
    .from("treatment_series")
    .select("id, patient_id, treatment_type, total_sessions, total_fee, currency, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (seriesError) throw seriesError
  if (!seriesRows || seriesRows.length === 0) return []

  const seriesIds = seriesRows.map((row) => row.id)

  const [{ data: treatmentRows, error: treatmentError }, { data: paymentRows, error: paymentError }] =
    await Promise.all([
      supabase.from("treatments").select("series_id, status").in("series_id", seriesIds),
      supabase.from("treatment_payments").select("series_id, amount, entry_type").in("series_id", seriesIds),
    ])

  if (treatmentError) throw treatmentError
  if (paymentError) throw paymentError

  const completedBySeriesId = new Map<string, number>()
  for (const row of treatmentRows ?? []) {
    if (row.status !== "completed") continue
    completedBySeriesId.set(row.series_id, (completedBySeriesId.get(row.series_id) ?? 0) + 1)
  }

  // `series_id` is guaranteed non-null here — queried via `.in("series_id", seriesIds)`,
  // which only Sprint 28's new treatment_plan_id-attached rows (never fetched by this
  // legacy series-only query) would leave null.
  const paymentsBySeriesId = new Map<string, { amount: number; entryType: TreatmentPaymentEntryType }[]>()
  for (const row of paymentRows ?? []) {
    const list = paymentsBySeriesId.get(row.series_id!) ?? []
    list.push({ amount: row.amount, entryType: row.entry_type })
    paymentsBySeriesId.set(row.series_id!, list)
  }

  return seriesRows.map((row) => {
    const completedSessions = completedBySeriesId.get(row.id) ?? 0
    const paidAmount = sumPaymentLedger(paymentsBySeriesId.get(row.id) ?? [])
    return {
      id: row.id,
      patientId: row.patient_id,
      treatmentType: row.treatment_type,
      totalSessions: row.total_sessions,
      completedSessions,
      remainingSessions: Math.max(row.total_sessions - completedSessions, 0),
      totalFee: row.total_fee,
      paidAmount,
      remainingBalance: deriveRemainingBalance(row.total_fee, paidAmount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
    }
  })
}

/** Only series a new session can be added to — active, not fully completed. Feeds "Pakete Seans Ekle"'s series picker. */
export async function getActiveSeriesForPatient(patientId: string): Promise<TreatmentSeriesListRow[]> {
  const rows = await getTreatmentSeriesForPatient(patientId)
  return rows.filter((row) => row.status === "active" && row.remainingSessions > 0)
}

/**
 * `remainingBalance` for a batch of series in one round trip — feeds the
 * "Tahsilat Bekliyor" rozeti/action on appointment cards (Sprint 18:
 * Takvim/Liste/Bugünkü Randevular), which only know a `series_id` from the
 * `treatments` embed and need the real ledger balance, not just presence of
 * a linked treatment. Same `deriveRemainingBalance`/`sumPaymentLedger` math
 * as everywhere else — no new financial logic, just batched by id.
 */
export async function getSeriesRemainingBalances(seriesIds: string[]): Promise<Map<string, number | null>> {
  const uniqueIds = Array.from(new Set(seriesIds))
  if (uniqueIds.length === 0) return new Map()

  const supabase = await createClient()
  const [{ data: seriesRows, error: seriesError }, { data: paymentRows, error: paymentError }] = await Promise.all([
    supabase.from("treatment_series").select("id, total_fee").in("id", uniqueIds),
    supabase.from("treatment_payments").select("series_id, amount, entry_type").in("series_id", uniqueIds),
  ])

  if (seriesError) throw seriesError
  if (paymentError) throw paymentError

  // `series_id` is guaranteed non-null here — see the same-shaped query above.
  const paymentsBySeriesId = new Map<string, { amount: number; entryType: TreatmentPaymentEntryType }[]>()
  for (const row of paymentRows ?? []) {
    const list = paymentsBySeriesId.get(row.series_id!) ?? []
    list.push({ amount: row.amount, entryType: row.entry_type })
    paymentsBySeriesId.set(row.series_id!, list)
  }

  const balances = new Map<string, number | null>()
  for (const row of seriesRows ?? []) {
    const paidAmount = sumPaymentLedger(paymentsBySeriesId.get(row.id) ?? [])
    balances.set(row.id, deriveRemainingBalance(row.total_fee, paidAmount))
  }
  return balances
}

/**
 * The next unclaimed session number for a series — `max(session_number) + 1`
 * among non-voided rows, not `completedSessions + 1`. Deliberately different
 * from `completeSession`'s "next number" (which asks "which session can be
 * marked done next"): this answers "which slot is free to pre-schedule next,"
 * so two appointments booked ahead for the same package (e.g. sessions 3 and
 * 4, both still `active`) never collide on the same number. Used by
 * `insertAppointment`'s "Mevcut Paketten Devam Et" flow (Sprint 13).
 */
export async function getNextAvailableSessionNumber(seriesId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("treatments")
    .select("session_number")
    .eq("series_id", seriesId)
    .neq("status", "voided")
    .order("session_number", { ascending: false })
    .limit(1)

  if (error) throw error
  return (data?.[0]?.session_number ?? 0) + 1
}

// ---------------------------------------------------------------------------
// treatment_series detail — one series, its sessions, its payment ledger.
// ---------------------------------------------------------------------------
export type TreatmentSessionRow = {
  id: string
  seriesId: string
  patientId: string
  staffId: string
  staffName: string
  appointmentId: string | null
  sessionNumber: number
  treatmentDate: string
  description: string | null
  controlDate: string | null
  status: TreatmentLifecycleStatus
  createdAt: string
}

export type TreatmentProductRow = {
  id: string
  treatmentId: string
  productName: string
  quantity: number
  unit: string | null
}

export type TreatmentPaymentRow = {
  id: string
  seriesId: string
  relatedPaymentId: string | null
  amount: number
  entryType: TreatmentPaymentEntryType
  method: TreatmentPaymentMethod
  currency: string
  paidAt: string
  recordedByName: string | null
  note: string | null
  createdAt: string
}

export type TreatmentSeriesDetail = TreatmentSeriesListRow & {
  sessions: TreatmentSessionRow[]
  payments: TreatmentPaymentRow[]
  activities: TreatmentActivityRow[]
}

const SESSION_SELECT =
  "id, series_id, patient_id, staff_id, appointment_id, session_number, treatment_date, description, control_date, status, created_at, staff:staff_members!treatments_staff_id_fkey(full_name)"

function mapSessionRow(row: {
  id: string
  series_id: string
  patient_id: string
  staff_id: string
  appointment_id: string | null
  session_number: number
  treatment_date: string
  description: string | null
  control_date: string | null
  status: TreatmentLifecycleStatus
  created_at: string
  staff: { full_name: string } | null
}): TreatmentSessionRow {
  return {
    id: row.id,
    seriesId: row.series_id,
    patientId: row.patient_id,
    staffId: row.staff_id,
    staffName: row.staff?.full_name ?? "",
    appointmentId: row.appointment_id,
    sessionNumber: row.session_number,
    treatmentDate: row.treatment_date,
    description: row.description,
    controlDate: row.control_date,
    status: row.status,
    createdAt: row.created_at,
  }
}

const PAYMENT_SELECT =
  "id, series_id, related_payment_id, amount, entry_type, method, currency, paid_at, note, created_at, recorded_staff:staff_members!treatment_payments_recorded_by_fkey(full_name)"

function mapPaymentRow(row: {
  id: string
  // Nullable at the DB level since Sprint 28 (treatment_plan_id-attached
  // rows leave it null) — every caller in this legacy module queries
  // `.eq("series_id", ...)`/`.in("series_id", seriesIds)`, so it is always
  // populated in practice here.
  series_id: string | null
  related_payment_id: string | null
  amount: number
  entry_type: TreatmentPaymentEntryType
  method: TreatmentPaymentMethod
  currency: string
  paid_at: string
  note: string | null
  created_at: string
  recorded_staff: { full_name: string } | null
}): TreatmentPaymentRow {
  return {
    id: row.id,
    seriesId: row.series_id!,
    relatedPaymentId: row.related_payment_id,
    amount: row.amount,
    entryType: row.entry_type,
    method: row.method,
    currency: row.currency,
    paidAt: row.paid_at,
    recordedByName: row.recorded_staff?.full_name ?? null,
    note: row.note,
    createdAt: row.created_at,
  }
}

export async function getTreatmentSeriesDetail(seriesId: string): Promise<TreatmentSeriesDetail | null> {
  const supabase = await createClient()

  const { data: series, error: seriesError } = await supabase
    .from("treatment_series")
    .select("id, patient_id, treatment_type, total_sessions, total_fee, currency, status, created_at")
    .eq("id", seriesId)
    .maybeSingle()

  if (seriesError) throw seriesError
  if (!series) return null

  const [{ data: sessionRows, error: sessionError }, { data: paymentRows, error: paymentError }] =
    await Promise.all([
      supabase
        .from("treatments")
        .select(SESSION_SELECT)
        .eq("series_id", seriesId)
        .order("session_number", { ascending: true }),
      supabase
        .from("treatment_payments")
        .select(PAYMENT_SELECT)
        .eq("series_id", seriesId)
        .order("paid_at", { ascending: false }),
    ])

  if (sessionError) throw sessionError
  if (paymentError) throw paymentError

  const sessions = (sessionRows ?? []).map(mapSessionRow)
  const payments = (paymentRows ?? []).map(mapPaymentRow)
  const completedSessions = sessions.filter((row) => row.status === "completed").length
  const paidAmount = sumPaymentLedger(payments)
  const activities = await getSeriesActivities(
    seriesId,
    sessions.map((session) => session.id),
  )

  return {
    id: series.id,
    patientId: series.patient_id,
    treatmentType: series.treatment_type,
    totalSessions: series.total_sessions,
    completedSessions,
    remainingSessions: Math.max(series.total_sessions - completedSessions, 0),
    totalFee: series.total_fee,
    paidAmount,
    remainingBalance: deriveRemainingBalance(series.total_fee, paidAmount),
    currency: series.currency,
    status: series.status,
    createdAt: series.created_at,
    sessions,
    payments,
    activities,
  }
}

export async function getSessionById(treatmentId: string): Promise<TreatmentSessionRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("treatments")
    .select(SESSION_SELECT)
    .eq("id", treatmentId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapSessionRow(data)
}

export async function getTreatmentProducts(treatmentId: string): Promise<TreatmentProductRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("treatment_products")
    .select("id, treatment_id, product_name, quantity, unit")
    .eq("treatment_id", treatmentId)
    .order("product_name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    treatmentId: row.treatment_id,
    productName: row.product_name,
    quantity: row.quantity,
    unit: row.unit,
  }))
}

// ---------------------------------------------------------------------------
// treatment_activities — shared timeline for both series- and session-level
// events. See docs/DATABASE.md#treatment-activities.
// ---------------------------------------------------------------------------
export type TreatmentActivityRow = {
  id: string
  treatmentId: string | null
  seriesId: string | null
  activityType: TreatmentActivityType
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
  authorName: string | null
}

function mapActivityRow(row: {
  id: string
  treatment_id: string | null
  series_id: string | null
  activity_type: TreatmentActivityType
  description: string
  metadata: unknown
  created_at: string
  author: { full_name: string } | null
}): TreatmentActivityRow {
  return {
    id: row.id,
    treatmentId: row.treatment_id,
    seriesId: row.series_id,
    activityType: row.activity_type,
    description: row.description,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    authorName: row.author?.full_name ?? null,
  }
}

const ACTIVITY_SELECT =
  "id, treatment_id, series_id, activity_type, description, metadata, created_at, author:staff_members!treatment_activities_created_by_fkey(full_name)"

/** The full timeline for a series: its own series-level events plus every one of its sessions' events, merged and sorted. */
export async function getSeriesActivities(seriesId: string, sessionIds: string[]): Promise<TreatmentActivityRow[]> {
  const supabase = await createClient()

  const orFilter =
    sessionIds.length > 0
      ? `series_id.eq.${seriesId},treatment_id.in.(${sessionIds.join(",")})`
      : `series_id.eq.${seriesId}`

  const { data, error } = await supabase
    .from("treatment_activities")
    .select(ACTIVITY_SELECT)
    .or(orFilter)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapActivityRow)
}

/**
 * Every series for a patient, each with its full session and payment lists
 * already attached — feeds Patient Detail's "Tedaviler" section, where each
 * series card expands in place to show its sessions/ledger without a
 * per-card round trip. Three queries total (series, all their sessions, all
 * their payments), regardless of how many series the patient has — same
 * "one query for the whole set, reshape in JS" discipline as the Calendar
 * and Dashboard.
 */
export async function getTreatmentSeriesForPatientWithDetails(
  patientId: string,
  limit = PATIENT_TREATMENT_SERIES_LIMIT,
): Promise<TreatmentSeriesDetail[]> {
  const supabase = await createClient()

  const { data: seriesRows, error: seriesError } = await supabase
    .from("treatment_series")
    .select("id, patient_id, treatment_type, total_sessions, total_fee, currency, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (seriesError) throw seriesError
  if (!seriesRows || seriesRows.length === 0) return []

  const seriesIds = seriesRows.map((row) => row.id)

  const [{ data: sessionRows, error: sessionError }, { data: paymentRows, error: paymentError }] =
    await Promise.all([
      supabase.from("treatments").select(SESSION_SELECT).in("series_id", seriesIds).order("session_number"),
      supabase.from("treatment_payments").select(PAYMENT_SELECT).in("series_id", seriesIds).order("paid_at", { ascending: false }),
    ])

  if (sessionError) throw sessionError
  if (paymentError) throw paymentError

  const sessions = (sessionRows ?? []).map(mapSessionRow)
  const payments = (paymentRows ?? []).map(mapPaymentRow)
  const sessionIds = sessions.map((row) => row.id)
  const seriesIdBySessionId = new Map(sessions.map((row) => [row.id, row.seriesId]))

  const orFilter =
    sessionIds.length > 0
      ? `series_id.in.(${seriesIds.join(",")}),treatment_id.in.(${sessionIds.join(",")})`
      : `series_id.in.(${seriesIds.join(",")})`

  const { data: activityRows, error: activityError } = await supabase
    .from("treatment_activities")
    .select(ACTIVITY_SELECT)
    .or(orFilter)
    .order("created_at", { ascending: false })

  if (activityError) throw activityError

  const sessionsBySeriesId = new Map<string, TreatmentSessionRow[]>()
  for (const row of sessions) {
    const list = sessionsBySeriesId.get(row.seriesId) ?? []
    list.push(row)
    sessionsBySeriesId.set(row.seriesId, list)
  }

  const paymentsBySeriesId = new Map<string, TreatmentPaymentRow[]>()
  for (const row of payments) {
    const list = paymentsBySeriesId.get(row.seriesId) ?? []
    list.push(row)
    paymentsBySeriesId.set(row.seriesId, list)
  }

  const activitiesBySeriesId = new Map<string, TreatmentActivityRow[]>()
  for (const row of (activityRows ?? []).map(mapActivityRow)) {
    const ownerSeriesId = row.seriesId ?? (row.treatmentId ? seriesIdBySessionId.get(row.treatmentId) : undefined)
    if (!ownerSeriesId) continue
    const list = activitiesBySeriesId.get(ownerSeriesId) ?? []
    list.push(row)
    activitiesBySeriesId.set(ownerSeriesId, list)
  }

  return seriesRows.map((row) => {
    const rowSessions = sessionsBySeriesId.get(row.id) ?? []
    const rowPayments = paymentsBySeriesId.get(row.id) ?? []
    const completedSessions = rowSessions.filter((session) => session.status === "completed").length
    const paidAmount = sumPaymentLedger(rowPayments)

    return {
      id: row.id,
      patientId: row.patient_id,
      treatmentType: row.treatment_type,
      totalSessions: row.total_sessions,
      completedSessions,
      remainingSessions: Math.max(row.total_sessions - completedSessions, 0),
      totalFee: row.total_fee,
      paidAmount,
      remainingBalance: deriveRemainingBalance(row.total_fee, paidAmount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      sessions: rowSessions,
      payments: rowPayments,
      activities: activitiesBySeriesId.get(row.id) ?? [],
    }
  })
}

// ---------------------------------------------------------------------------
// Treatments Export — one row per treatment_series, clinic-wide. A
// standalone treatment is a size-1 series (`totalSessions === 1`), so it
// comes through this same list with no special case — the "every treatment
// always belongs to a series" architecture collapsing the two shapes into
// one, exactly as intended. `voided` series are excluded (never a real
// event), same as the Dashboard's financial aggregates.
// ---------------------------------------------------------------------------
export type TreatmentSeriesExportRow = {
  id: string
  patientName: string
  patientTcKimlikNo: string | null
  treatmentType: string
  totalFee: number | null
  paidAmount: number
  remainingBalance: number | null
  currency: string
  totalSessions: number
  completedSessions: number
  status: TreatmentLifecycleStatus
  primaryStaffName: string | null
}

/**
 * Tier 3 — clinic-wide financial (docs/DATABASE.md#three-tier-financial-visibility),
 * gated on `financial_access` exactly like `lib/dashboard/queries.ts`'
 * `getFinancialSummary()`. Fixed post-Sprint-7-implementation, pre-close:
 * every individual row here is Tier-1-legal (any clinical/front-desk role
 * can already read one patient's fee/paid/balance), but exporting *every*
 * patient's financial data in one document is exactly the "aggregate
 * Tier-1-readable rows into Tier-3" reconstruction the AI Data Access
 * Principle names as the real limit of RLS alone (docs/ARCHITECTURE.md) —
 * whether the aggregator is an AI tool call or an Excel export route, the
 * exposure is the same, so it gets the same gate. Returns `null` when
 * unauthorized (caller — the route — decides how to respond), not an empty
 * array, so "no data" and "not allowed" are never conflated.
 */
export async function getAllTreatmentSeriesForExport(): Promise<TreatmentSeriesExportRow[] | null> {
  const hasAccess = await currentStaffHasPermission("financial_access")
  if (!hasAccess) return null

  const supabase = await createClient()

  const { data: seriesRows, error: seriesError } = await supabase
    .from("treatment_series")
    .select(
      "id, treatment_type, total_sessions, total_fee, currency, status, created_at, patient:patients!treatment_series_patient_id_fkey(full_name, tc_kimlik_no)",
    )
    .neq("status", "voided")
    .order("created_at", { ascending: false })

  if (seriesError) throw seriesError
  if (!seriesRows || seriesRows.length === 0) return []

  const seriesIds = seriesRows.map((row) => row.id)

  const [{ data: treatmentRows, error: treatmentError }, { data: paymentRows, error: paymentError }] =
    await Promise.all([
      supabase
        .from("treatments")
        .select("series_id, staff_id, status, staff:staff_members!treatments_staff_id_fkey(full_name)")
        .in("series_id", seriesIds)
        .neq("status", "voided"),
      supabase.from("treatment_payments").select("series_id, amount, entry_type").in("series_id", seriesIds),
    ])

  if (treatmentError) throw treatmentError
  if (paymentError) throw paymentError

  const primaryStaffBySeriesId = resolvePrimaryStaffBySeries(
    (treatmentRows ?? []).map((row) => ({
      seriesId: row.series_id,
      staffId: row.staff_id,
      staffName: row.staff?.full_name ?? "",
    })),
  )

  const completedBySeriesId = new Map<string, number>()
  for (const row of treatmentRows ?? []) {
    if (row.status !== "completed") continue
    completedBySeriesId.set(row.series_id, (completedBySeriesId.get(row.series_id) ?? 0) + 1)
  }

  // `series_id` is guaranteed non-null here — queried via `.in("series_id", seriesIds)`,
  // which only Sprint 28's new treatment_plan_id-attached rows (never fetched by this
  // legacy series-only query) would leave null.
  const paymentsBySeriesId = new Map<string, { amount: number; entryType: TreatmentPaymentEntryType }[]>()
  for (const row of paymentRows ?? []) {
    const list = paymentsBySeriesId.get(row.series_id!) ?? []
    list.push({ amount: row.amount, entryType: row.entry_type })
    paymentsBySeriesId.set(row.series_id!, list)
  }

  return seriesRows.map((row) => {
    const paidAmount = sumPaymentLedger(paymentsBySeriesId.get(row.id) ?? [])
    const primaryStaff = primaryStaffBySeriesId.get(row.id)

    return {
      id: row.id,
      patientName: row.patient?.full_name ?? "",
      patientTcKimlikNo: row.patient?.tc_kimlik_no ?? null,
      treatmentType: row.treatment_type,
      totalFee: row.total_fee,
      paidAmount,
      remainingBalance: deriveRemainingBalance(row.total_fee, paidAmount),
      currency: row.currency,
      totalSessions: row.total_sessions,
      completedSessions: completedBySeriesId.get(row.id) ?? 0,
      status: row.status,
      primaryStaffName: primaryStaff?.staffName ?? null,
    }
  })
}

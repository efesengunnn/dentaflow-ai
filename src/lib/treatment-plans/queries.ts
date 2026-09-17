import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { createClient } from "@/lib/supabase/server"
import {
  FOLLOW_UP_RULES,
  INACTIVE_PATIENT_THRESHOLD_DAYS,
  PATIENT_TREATMENT_PLAN_LIMIT,
  PLAN_ENDING_SESSIONS_REMAINING,
  type FollowUpRuleKey,
  type TreatmentActivityType,
  type TreatmentLifecycleStatus,
  type TreatmentPaymentEntryType,
  type TreatmentPaymentMethod,
  type TreatmentSessionStatus,
} from "@/lib/treatment-plans/constants"

// ---------------------------------------------------------------------------
// Ledger math — identical rules to `lib/treatments/queries.ts`'s
// `deriveRemainingBalance`/`paymentLedgerSign`/`sumPaymentLedger`, duplicated
// (not imported) here rather than shared, matching this module's deliberate
// independence from the legacy module ahead of its eventual retirement (see
// `lib/treatment-plans/constants.ts`).
// ---------------------------------------------------------------------------

/** `totalAmount - paidAmount`, or `null` when the total itself is unset ("Belirlenmedi") — a balance can't exist against an unknown total. */
export function deriveRemainingBalance(totalAmount: number | null, paidAmount: number): number | null {
  return totalAmount === null ? null : totalAmount - paidAmount
}

/** `payment`/`adjustment` add to the ledger total, `refund`/`void` subtract. */
export function paymentLedgerSign(entryType: TreatmentPaymentEntryType): 1 | -1 {
  return entryType === "refund" || entryType === "void" ? -1 : 1
}

/** "Ödenen Tutar" is `SUM(payment) + SUM(adjustment) - SUM(refund) - SUM(void)` — never stored, always derived from the ledger. */
export function sumPaymentLedger(rows: { amount: number; entryType: TreatmentPaymentEntryType }[]): number {
  return rows.reduce((total, row) => total + paymentLedgerSign(row.entryType) * row.amount, 0)
}

/** `treatment_plans.total_amount` is always `SUM(treatment_plan_items.total_price)` (founder decision, Sprint 28) — never stored. `null` only when *no* item has a price set yet, not when some do and some don't (a partially-priced plan still has a real, if incomplete, total). */
function deriveTotalAmount(items: { totalPrice: number | null }[]): number | null {
  if (items.length === 0) return null
  if (!items.some((item) => item.totalPrice !== null)) return null
  return items.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
}

/** One currency's slice of a plan's ledger (Sprint 31). `total` is `null` when no item in this currency has a price set yet ("Belirlenmedi"). */
export type PlanCurrencyTotal = {
  currency: string
  total: number | null
  paid: number
  remaining: number | null
}

/**
 * Per-currency total/paid/remaining for a plan (Sprint 31 — mixed-currency
 * plans are allowed). Items are grouped by their own currency for the total,
 * payments by their currency for paid; figures are never summed across
 * currencies (you can't add ₺ to €). TRY is listed first, then others
 * alphabetically, for a stable render order.
 */
export function deriveCurrencyTotals(
  items: { currency: string; totalPrice: number | null }[],
  payments: { currency: string; amount: number; entryType: TreatmentPaymentEntryType }[],
): PlanCurrencyTotal[] {
  const currencies = new Set<string>()
  for (const item of items) currencies.add(item.currency)
  for (const payment of payments) currencies.add(payment.currency)

  return Array.from(currencies)
    .map((currency) => {
      const total = deriveTotalAmount(items.filter((item) => item.currency === currency))
      const paid = sumPaymentLedger(payments.filter((payment) => payment.currency === currency))
      return { currency, total, paid, remaining: deriveRemainingBalance(total, paid) }
    })
    .sort((a, b) =>
      a.currency === "TRY" ? -1 : b.currency === "TRY" ? 1 : a.currency.localeCompare(b.currency),
    )
}

function daysBetween(isoDate: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function groupBy<T, K>(rows: T[], keyOf: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return map
}

// ---------------------------------------------------------------------------
// treatment_sessions
// ---------------------------------------------------------------------------
export type TreatmentSessionRow = {
  id: string
  treatmentPlanItemId: string
  patientId: string
  appointmentId: string | null
  sessionNumber: number
  performedById: string
  performedByName: string
  performedAt: string
  controlDate: string | null
  notes: string | null
  unitPriceSnapshot: number | null
  status: TreatmentSessionStatus
  correctedById: string | null
  correctedByName: string | null
  correctedAt: string | null
  correctionReason: string | null
  replacedBySessionId: string | null
  createdAt: string
}

const SESSION_SELECT =
  "id, treatment_plan_item_id, patient_id, appointment_id, session_number, performed_by, performed_at, control_date, notes, unit_price_snapshot, status, corrected_by, corrected_at, correction_reason, replaced_by_session_id, created_at, performed_staff:staff_members!treatment_sessions_performed_by_fkey(full_name), corrected_staff:staff_members!treatment_sessions_corrected_by_fkey(full_name)"

function mapSessionRow(row: {
  id: string
  treatment_plan_item_id: string
  patient_id: string
  appointment_id: string | null
  session_number: number
  performed_by: string
  performed_at: string
  control_date: string | null
  notes: string | null
  unit_price_snapshot: number | null
  status: TreatmentSessionStatus
  corrected_by: string | null
  corrected_at: string | null
  correction_reason: string | null
  replaced_by_session_id: string | null
  created_at: string
  performed_staff: { full_name: string } | null
  corrected_staff: { full_name: string } | null
}): TreatmentSessionRow {
  return {
    id: row.id,
    treatmentPlanItemId: row.treatment_plan_item_id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    sessionNumber: row.session_number,
    performedById: row.performed_by,
    performedByName: row.performed_staff?.full_name ?? "",
    performedAt: row.performed_at,
    controlDate: row.control_date,
    notes: row.notes,
    unitPriceSnapshot: row.unit_price_snapshot,
    status: row.status,
    correctedById: row.corrected_by,
    correctedByName: row.corrected_staff?.full_name ?? null,
    correctedAt: row.corrected_at,
    correctionReason: row.correction_reason,
    replacedBySessionId: row.replaced_by_session_id,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// treatment_payments (rows attached to treatment_plan_id only — legacy
// series-attached rows are never returned here, see the extending migration).
// ---------------------------------------------------------------------------
export type TreatmentPlanPaymentRow = {
  id: string
  treatmentPlanId: string
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

const PAYMENT_SELECT =
  "id, treatment_plan_id, related_payment_id, amount, entry_type, method, currency, paid_at, note, created_at, recorded_staff:staff_members!treatment_payments_recorded_by_fkey(full_name)"

function mapPaymentRow(row: {
  id: string
  treatment_plan_id: string | null
  related_payment_id: string | null
  amount: number
  entry_type: TreatmentPaymentEntryType
  method: TreatmentPaymentMethod
  currency: string
  paid_at: string
  note: string | null
  created_at: string
  recorded_staff: { full_name: string } | null
}): TreatmentPlanPaymentRow {
  return {
    id: row.id,
    treatmentPlanId: row.treatment_plan_id ?? "",
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

// ---------------------------------------------------------------------------
// treatment_activities (rows attached to treatment_plan_id /
// treatment_plan_item_id / treatment_session_id — legacy series/treatment-
// attached rows are never returned here).
// ---------------------------------------------------------------------------
export type TreatmentPlanActivityRow = {
  id: string
  treatmentPlanId: string | null
  treatmentPlanItemId: string | null
  treatmentSessionId: string | null
  activityType: TreatmentActivityType
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
  authorName: string | null
}

const ACTIVITY_SELECT =
  "id, treatment_plan_id, treatment_plan_item_id, treatment_session_id, activity_type, description, metadata, created_at, author:staff_members!treatment_activities_created_by_fkey(full_name)"

function mapActivityRow(row: {
  id: string
  treatment_plan_id: string | null
  treatment_plan_item_id: string | null
  treatment_session_id: string | null
  activity_type: TreatmentActivityType
  description: string
  metadata: unknown
  created_at: string
  author: { full_name: string } | null
}): TreatmentPlanActivityRow {
  return {
    id: row.id,
    treatmentPlanId: row.treatment_plan_id,
    treatmentPlanItemId: row.treatment_plan_item_id,
    treatmentSessionId: row.treatment_session_id,
    activityType: row.activity_type,
    description: row.description,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    authorName: row.author?.full_name ?? null,
  }
}

// ---------------------------------------------------------------------------
// treatment_plan_items + treatment_plans — assembled into one
// TreatmentPlanDetail per plan, shared by both public entry points below.
// ---------------------------------------------------------------------------
export type TreatmentPlanItemDetail = {
  id: string
  treatmentPlanId: string
  providerId: string
  providerName: string
  treatmentName: string
  sessionCount: number
  completedSessions: number
  remainingSessions: number
  unitPrice: number | null
  totalPrice: number | null
  /** Sprint 31 — item-level currency (TRY/EUR); unitPrice/totalPrice are in this currency. */
  currency: string
  /** Owner-only revenue attribution (Sprint 28A decision) — callers must gate rendering on the viewer's role themselves, this query never does. */
  providerShareAmount: number | null
  /** Sprint 30.3 — planned follow-up date, set at definition time (optional). Distinct from a session's own `controlDate`, recorded retroactively at completion. */
  controlDate: string | null
  /** Sprint 33 — FDI tooth numbers this item targets; empty means whole-mouth / not tooth-specific. */
  toothNumbers: number[]
  status: TreatmentLifecycleStatus
  revisionNo: number
  sessions: TreatmentSessionRow[]
}

export type TreatmentPlanDetail = {
  id: string
  patientId: string
  planName: string
  currency: string
  status: TreatmentLifecycleStatus
  /** Always `SUM(items.totalPrice)` — see `deriveTotalAmount`. Cross-currency sum; only meaningful for a single-currency plan. Prefer `currencyTotals` for display. */
  totalAmount: number | null
  paidAmount: number
  remainingBalance: number | null
  /** Sprint 31 — per-currency total/paid/remaining; the source of truth for display now that a plan can mix currencies. */
  currencyTotals: PlanCurrencyTotal[]
  createdAt: string
  items: TreatmentPlanItemDetail[]
  payments: TreatmentPlanPaymentRow[]
  activities: TreatmentPlanActivityRow[]
}

/**
 * `includeDeleted` defaults to `false` everywhere it appears in this module
 * (Sprint 28C.1) — every normal read excludes soft-deleted plans/items/
 * sessions; only a future admin/audit view would ever pass `true`. No such
 * view exists yet, this is the read-side half of the delete feature landing
 * now so the backend contract is complete.
 */
async function loadTreatmentPlanDetails(
  planIds: string[],
  includeDeleted = false,
): Promise<Map<string, TreatmentPlanDetail>> {
  if (planIds.length === 0) return new Map()
  const supabase = await createClient()

  let planQuery = supabase
    .from("treatment_plans")
    .select("id, patient_id, plan_name, currency, status, created_at")
    .in("id", planIds)
  if (!includeDeleted) planQuery = planQuery.is("deleted_at", null)
  const { data: planRows, error: planError } = await planQuery
  if (planError) throw planError

  let itemQuery = supabase
    .from("treatment_plan_items")
    .select(
      "id, treatment_plan_id, provider_id, treatment_name, session_count, unit_price, total_price, currency, provider_share_amount, control_date, tooth_numbers, status, revision_no, provider:staff_members!treatment_plan_items_provider_id_fkey(full_name)",
    )
    .in("treatment_plan_id", planIds)
  if (!includeDeleted) itemQuery = itemQuery.is("deleted_at", null)
  const { data: itemRows, error: itemError } = await itemQuery
  if (itemError) throw itemError

  const items = itemRows ?? []
  const itemIds = items.map((row) => row.id)

  let sessionQuery =
    itemIds.length > 0
      ? supabase
          .from("treatment_sessions")
          .select(SESSION_SELECT)
          .in("treatment_plan_item_id", itemIds)
          .order("session_number", { ascending: true })
      : null
  if (sessionQuery && !includeDeleted) sessionQuery = sessionQuery.is("deleted_at", null)

  const [{ data: sessionRows, error: sessionError }, { data: paymentRows, error: paymentError }] = await Promise.all([
    sessionQuery ?? Promise.resolve({ data: [], error: null }),
    supabase.from("treatment_payments").select(PAYMENT_SELECT).in("treatment_plan_id", planIds).order("paid_at", { ascending: false }),
  ])
  if (sessionError) throw sessionError
  if (paymentError) throw paymentError

  const sessions = (sessionRows ?? []).map(mapSessionRow)
  const payments = (paymentRows ?? []).map(mapPaymentRow)
  const sessionIds = sessions.map((row) => row.id)
  const itemIdToPlanId = new Map(items.map((row) => [row.id, row.treatment_plan_id]))
  const sessionIdToItemId = new Map(sessions.map((row) => [row.id, row.treatmentPlanItemId]))

  const orParts = [`treatment_plan_id.in.(${planIds.join(",")})`]
  if (itemIds.length > 0) orParts.push(`treatment_plan_item_id.in.(${itemIds.join(",")})`)
  if (sessionIds.length > 0) orParts.push(`treatment_session_id.in.(${sessionIds.join(",")})`)

  const { data: activityRows, error: activityError } = await supabase
    .from("treatment_activities")
    .select(ACTIVITY_SELECT)
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
  if (activityError) throw activityError

  const activities = (activityRows ?? []).map(mapActivityRow)
  const sessionsByItemId = groupBy(sessions, (row) => row.treatmentPlanItemId)
  const paymentsByPlanId = groupBy(payments, (row) => row.treatmentPlanId)

  const activitiesByPlanId = new Map<string, TreatmentPlanActivityRow[]>()
  for (const row of activities) {
    const planId =
      row.treatmentPlanId ??
      (row.treatmentPlanItemId ? itemIdToPlanId.get(row.treatmentPlanItemId) : undefined) ??
      (row.treatmentSessionId
        ? itemIdToPlanId.get(sessionIdToItemId.get(row.treatmentSessionId) ?? "")
        : undefined)
    if (!planId) continue
    const list = activitiesByPlanId.get(planId) ?? []
    list.push(row)
    activitiesByPlanId.set(planId, list)
  }

  const itemsByPlanId = new Map<string, TreatmentPlanItemDetail[]>()
  for (const row of items) {
    const itemSessions = sessionsByItemId.get(row.id) ?? []
    const completedSessions = itemSessions.filter((session) => session.status === "completed").length
    const item: TreatmentPlanItemDetail = {
      id: row.id,
      treatmentPlanId: row.treatment_plan_id,
      providerId: row.provider_id,
      providerName: row.provider?.full_name ?? "",
      treatmentName: row.treatment_name,
      sessionCount: row.session_count,
      completedSessions,
      remainingSessions: Math.max(row.session_count - completedSessions, 0),
      unitPrice: row.unit_price,
      totalPrice: row.total_price,
      currency: row.currency,
      providerShareAmount: row.provider_share_amount,
      controlDate: row.control_date,
      toothNumbers: row.tooth_numbers ?? [],
      status: row.status,
      revisionNo: row.revision_no,
      sessions: itemSessions,
    }
    const list = itemsByPlanId.get(row.treatment_plan_id) ?? []
    list.push(item)
    itemsByPlanId.set(row.treatment_plan_id, list)
  }

  const detailMap = new Map<string, TreatmentPlanDetail>()
  for (const row of planRows ?? []) {
    const planItems = itemsByPlanId.get(row.id) ?? []
    const planPayments = paymentsByPlanId.get(row.id) ?? []
    const totalAmount = deriveTotalAmount(planItems)
    const paidAmount = sumPaymentLedger(planPayments)
    detailMap.set(row.id, {
      id: row.id,
      patientId: row.patient_id,
      planName: row.plan_name,
      currency: row.currency,
      status: row.status,
      totalAmount,
      paidAmount,
      remainingBalance: deriveRemainingBalance(totalAmount, paidAmount),
      currencyTotals: deriveCurrencyTotals(planItems, planPayments),
      createdAt: row.created_at,
      items: planItems,
      payments: planPayments,
      activities: activitiesByPlanId.get(row.id) ?? [],
    })
  }
  return detailMap
}

/**
 * Every Tedavi Planı for a patient, each with its items/sessions/payments/
 * activities already attached — feeds the future Patient Detail "Tedavi
 * Planları" section (replaces `getTreatmentSeriesForPatientWithDetails`),
 * same "one batched query per range, not a per-plan round trip" discipline.
 */
export async function getPatientTreatmentPlans(
  patientId: string,
  limit = PATIENT_TREATMENT_PLAN_LIMIT,
  includeDeleted = false,
): Promise<TreatmentPlanDetail[]> {
  const supabase = await createClient()
  let listQuery = supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (!includeDeleted) listQuery = listQuery.is("deleted_at", null)
  const { data: planRows, error } = await listQuery
  if (error) throw error

  const planIds = (planRows ?? []).map((row) => row.id)
  if (planIds.length === 0) return []

  const detailMap = await loadTreatmentPlanDetails(planIds, includeDeleted)
  return planIds.map((id) => detailMap.get(id)).filter((row): row is TreatmentPlanDetail => row !== undefined)
}

/** One plan's full detail, by id — replaces `getTreatmentSeriesDetail`, same on-demand-fetch usage (e.g. a Dashboard drill-down). `includeDeleted: true` is the audit-view escape hatch — no consumer passes it yet. */
export async function getTreatmentPlanDetail(planId: string, includeDeleted = false): Promise<TreatmentPlanDetail | null> {
  const detailMap = await loadTreatmentPlanDetails([planId], includeDeleted)
  return detailMap.get(planId) ?? null
}

// ---------------------------------------------------------------------------
// getRemainingSessionsForPatient — feeds the appointment combo-flow's
// "Mevcut Plandan Devam Et" item picker (only items with remaining sessions
// on an active plan are selectable). A dedicated lean query, not a reuse of
// `getPatientTreatmentPlans`'s full detail — matches the existing
// `getActiveSeriesForPatient` precedent of a narrow, on-demand read.
// ---------------------------------------------------------------------------
export type RemainingSessionItem = {
  treatmentPlanId: string
  planName: string
  itemId: string
  treatmentName: string
  providerId: string
  providerName: string
  sessionCount: number
  remainingSessions: number
}

export async function getRemainingSessionsForPatient(patientId: string): Promise<RemainingSessionItem[]> {
  const supabase = await createClient()

  const { data: planRows, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, plan_name")
    .eq("patient_id", patientId)
    .eq("status", "active")
  if (planError) throw planError

  const plans = planRows ?? []
  if (plans.length === 0) return []
  const planIds = plans.map((row) => row.id)
  const planNameById = new Map(plans.map((row) => [row.id, row.plan_name]))

  const { data: itemRows, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select(
      "id, treatment_plan_id, provider_id, treatment_name, session_count, provider:staff_members!treatment_plan_items_provider_id_fkey(full_name)",
    )
    .in("treatment_plan_id", planIds)
    .eq("status", "active")
    .is("deleted_at", null)
  if (itemError) throw itemError

  const items = itemRows ?? []
  if (items.length === 0) return []
  const itemIds = items.map((row) => row.id)

  const { data: sessionRows, error: sessionError } = await supabase
    .from("treatment_sessions")
    .select("treatment_plan_item_id")
    .in("treatment_plan_item_id", itemIds)
    .eq("status", "completed")
    .is("deleted_at", null)
  if (sessionError) throw sessionError

  const completedByItemId = new Map<string, number>()
  for (const row of sessionRows ?? []) {
    completedByItemId.set(row.treatment_plan_item_id, (completedByItemId.get(row.treatment_plan_item_id) ?? 0) + 1)
  }

  const rows: RemainingSessionItem[] = []
  for (const item of items) {
    const completed = completedByItemId.get(item.id) ?? 0
    const remaining = Math.max(item.session_count - completed, 0)
    if (remaining <= 0) continue
    rows.push({
      treatmentPlanId: item.treatment_plan_id,
      planName: planNameById.get(item.treatment_plan_id) ?? "",
      itemId: item.id,
      treatmentName: item.treatment_name,
      providerId: item.provider_id,
      providerName: item.provider?.full_name ?? "",
      sessionCount: item.session_count,
      remainingSessions: remaining,
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// getProviderRevenueBreakdown — owner-only, clinic-wide. Replaces the legacy
// `resolvePrimaryStaffBySeries` "100% to whichever staff performed the most
// sessions" heuristic with real per-item attribution.
// ---------------------------------------------------------------------------
export type ProviderRevenueBreakdownRow = {
  providerId: string
  providerName: string
  attributedRevenue: number
}

/**
 * Founder decision (Sprint 28): `provider_share_amount` is revenue
 * attribution, visible to `owner` only — not even the provider themself,
 * and deliberately *not* gated by the generic `financial_access` permission
 * (a non-owner could in principle be granted that permission; this figure
 * must stay stricter). `voided` items are excluded — never real revenue,
 * same convention as every other financial aggregate in this schema (see
 * `getAllTreatmentSeriesForExport`). Returns `null` for a non-owner caller,
 * not `[]`, so "no data" and "not allowed" are never conflated.
 */
export async function getProviderRevenueBreakdown(): Promise<ProviderRevenueBreakdownRow[] | null> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember || staffMember.role !== "owner") return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("treatment_plan_items")
    .select(
      "provider_id, total_price, provider_share_amount, status, provider:staff_members!treatment_plan_items_provider_id_fkey(full_name)",
    )
    .neq("status", "voided")
    .is("deleted_at", null)
  if (error) throw error

  const revenueByProviderId = new Map<string, { providerName: string; total: number }>()
  for (const row of data ?? []) {
    const attributed = row.provider_share_amount ?? row.total_price ?? 0
    const existing = revenueByProviderId.get(row.provider_id) ?? {
      providerName: row.provider?.full_name ?? "",
      total: 0,
    }
    existing.total += attributed
    revenueByProviderId.set(row.provider_id, existing)
  }

  return Array.from(revenueByProviderId.entries())
    .map(([providerId, value]) => ({ providerId, providerName: value.providerName, attributedRevenue: value.total }))
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue)
}

// ---------------------------------------------------------------------------
// getAllTreatmentPlans — Sprint 30.3, feeds the owner-only "Paketler" screen.
// Same owner-only access pattern as getProviderRevenueBreakdown (returns
// `null` for a non-owner caller, not `[]`, so "no data" and "not allowed"
// stay distinguishable). A lean list read — no items/sessions/payments
// attached, the detail view fetches those separately via
// `getTreatmentPlanDetail` for the one plan being viewed.
// ---------------------------------------------------------------------------
export type TreatmentPlanListRow = {
  id: string
  patientId: string
  patientName: string
  planName: string
  status: TreatmentLifecycleStatus
  /** Always `SUM(items.totalPrice)`, same rule as `deriveTotalAmount` — `null` only when no item has a price set yet. */
  totalAmount: number | null
  createdAt: string
}

export async function getAllTreatmentPlans(filters?: {
  status?: TreatmentLifecycleStatus
}): Promise<TreatmentPlanListRow[] | null> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember || staffMember.role !== "owner") return null

  const supabase = await createClient()
  let planQuery = supabase
    .from("treatment_plans")
    .select("id, patient_id, plan_name, status, created_at, patient:patients!treatment_plans_patient_id_fkey(full_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (filters?.status) planQuery = planQuery.eq("status", filters.status)
  const { data: planRows, error: planError } = await planQuery
  if (planError) throw planError

  const plans = planRows ?? []
  if (plans.length === 0) return []
  const planIds = plans.map((row) => row.id)

  const { data: itemRows, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select("treatment_plan_id, total_price")
    .in("treatment_plan_id", planIds)
    .is("deleted_at", null)
  if (itemError) throw itemError

  const totalsByPlanId = new Map<string, { hasPrice: boolean; sum: number }>()
  for (const row of itemRows ?? []) {
    const existing = totalsByPlanId.get(row.treatment_plan_id) ?? { hasPrice: false, sum: 0 }
    if (row.total_price !== null) {
      existing.hasPrice = true
      existing.sum += row.total_price
    }
    totalsByPlanId.set(row.treatment_plan_id, existing)
  }

  return plans.map((row) => {
    const totals = totalsByPlanId.get(row.id)
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient?.full_name ?? "",
      planName: row.plan_name,
      status: row.status,
      totalAmount: totals?.hasPrice ? totals.sum : null,
      createdAt: row.created_at,
    }
  })
}

// ---------------------------------------------------------------------------
// getFollowUpCandidatesForAI — new-schema equivalent of
// `lib/ai/queries.ts`'s legacy `getFollowUpCandidatesForAI` (reads
// treatment_plan_items/treatment_sessions instead of
// treatment_series/treatments). The legacy AI-layer cutover (wiring this
// into `lib/ai/tools.ts`) is a later step of Sprint 28, not part of this
// migration/query-layer pass.
// ---------------------------------------------------------------------------
export type AIFollowUpCandidate = {
  patientId: string
  fullName: string
  lastSessionDate: string
  daysSinceLastSession: number
}

export type AIPlanEndingSoonCandidate = {
  patientId: string
  fullName: string
  treatmentName: string
  remainingSessions: number
}

export type AIFollowUpCandidates = {
  byRule: Record<FollowUpRuleKey, AIFollowUpCandidate[]>
  planEndingSoon: AIPlanEndingSoonCandidate[]
  inactivePatients: AIFollowUpCandidate[]
}

export async function getFollowUpCandidatesForAI(): Promise<AIFollowUpCandidates> {
  const supabase = await createClient()

  const { data: itemRows, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select("id, patient_id, treatment_name, session_count, status, patients!inner(full_name, deleted_at)")
    .neq("status", "voided")
    .is("deleted_at", null)
    .is("patients.deleted_at", null)
  if (itemError) throw itemError

  const items = itemRows ?? []
  const itemIds = items.map((row) => row.id)

  const { data: sessionRows, error: sessionError } =
    itemIds.length > 0
      ? await supabase
          .from("treatment_sessions")
          .select("treatment_plan_item_id, performed_at, control_date")
          .in("treatment_plan_item_id", itemIds)
          .eq("status", "completed")
          .is("deleted_at", null)
      : { data: [] as { treatment_plan_item_id: string; performed_at: string; control_date: string | null }[], error: null }
  if (sessionError) throw sessionError

  const completedCountByItemId = new Map<string, number>()
  const latestSessionByItemId = new Map<string, { performedAt: string; controlDate: string | null }>()
  for (const row of sessionRows ?? []) {
    completedCountByItemId.set(row.treatment_plan_item_id, (completedCountByItemId.get(row.treatment_plan_item_id) ?? 0) + 1)
    const existing = latestSessionByItemId.get(row.treatment_plan_item_id)
    if (!existing || row.performed_at > existing.performedAt) {
      latestSessionByItemId.set(row.treatment_plan_item_id, { performedAt: row.performed_at, controlDate: row.control_date })
    }
  }

  const now = new Date()
  const byRule = Object.fromEntries(FOLLOW_UP_RULES.map((rule) => [rule.key, [] as AIFollowUpCandidate[]])) as Record<
    FollowUpRuleKey,
    AIFollowUpCandidate[]
  >
  const planEndingSoon: AIPlanEndingSoonCandidate[] = []
  const latestOverallByPatientId = new Map<string, { fullName: string; date: string }>()

  for (const row of items) {
    const patientId = row.patient_id
    const fullName = row.patients?.full_name ?? "Bilinmeyen Hasta"
    const lastSession = latestSessionByItemId.get(row.id)

    if (lastSession) {
      const existingOverall = latestOverallByPatientId.get(patientId)
      if (!existingOverall || lastSession.performedAt > existingOverall.date) {
        latestOverallByPatientId.set(patientId, { fullName, date: lastSession.performedAt })
      }

      const treatmentNameLower = row.treatment_name.toLocaleLowerCase("tr")
      const matchedRule = FOLLOW_UP_RULES.find((rule) =>
        rule.keywords.some((keyword) => treatmentNameLower.includes(keyword)),
      )
      if (matchedRule) {
        const dueDate = lastSession.controlDate ?? addDays(lastSession.performedAt, matchedRule.intervalDays)
        if (new Date(dueDate) <= now) {
          byRule[matchedRule.key].push({
            patientId,
            fullName,
            lastSessionDate: lastSession.performedAt,
            daysSinceLastSession: daysBetween(lastSession.performedAt, now),
          })
        }
      }
    }

    if (row.status === "active") {
      const completed = completedCountByItemId.get(row.id) ?? 0
      const remaining = Math.max(row.session_count - completed, 0)
      if (remaining === PLAN_ENDING_SESSIONS_REMAINING) {
        planEndingSoon.push({ patientId, fullName, treatmentName: row.treatment_name, remainingSessions: remaining })
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

  return { byRule, planEndingSoon, inactivePatients }
}

// ---------------------------------------------------------------------------
// getAppointmentLinkedTreatmentPlanItem — Sprint 28D. Feeds the appointment
// detail page's "Seansı Tamamla" quick action, resolving
// appointments.treatment_plan_item_id (set at booking time, Sprint 28C) into
// the item's live session progress. Entirely separate from the legacy
// `AppointmentDetail.linkedTreatment` (treatment_series-based) — an
// appointment has at most one of the two links, never both.
// ---------------------------------------------------------------------------
export type AppointmentLinkedTreatmentPlanItem = {
  treatmentPlanId: string
  treatmentPlanItemId: string
  planName: string
  treatmentName: string
  providerId: string
  providerName: string
  sessionCount: number
  completedSessions: number
  remainingSessions: number
  itemStatus: TreatmentLifecycleStatus
  /** Whether a `completed` session already exists tied to *this* appointment — the same idempotency check `completeTreatmentSession` re-verifies server-side, mirrored here so the button/badge choice never lies. */
  hasCompletedSessionForAppointment: boolean
  /**
   * Plan-level financial figures (Sprint 31 — founder bug report 2026-09-11:
   * "randevu oluşturup ödeme al dediğimde panelde bunun sonucu verilmiyor").
   * The appointment detail panel could show a linked new-model plan's session
   * progress but nothing about money — no total, no paid/remaining, no way to
   * take payment — even though the plan carried a price and payments existed.
   * Same per-plan ledger math as `PatientPaymentsSection` / `getTreatmentPlanDetail`.
   *
   * Sprint 31 — per currency now (a plan can mix TRY + EUR items), so the
   * panel shows one Toplam/Ödenen/Kalan row-set per currency.
   */
  currencyTotals: PlanCurrencyTotal[]
}

export async function getAppointmentLinkedTreatmentPlanItem(
  appointmentId: string,
): Promise<AppointmentLinkedTreatmentPlanItem | null> {
  const supabase = await createClient()

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("treatment_plan_id, treatment_plan_item_id")
    .eq("id", appointmentId)
    .maybeSingle()

  if (appointmentError || !appointment?.treatment_plan_id || !appointment.treatment_plan_item_id) return null

  const { data: item, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select(
      "id, treatment_plan_id, provider_id, treatment_name, session_count, status, provider:staff_members!treatment_plan_items_provider_id_fkey(full_name), plan:treatment_plans!treatment_plan_items_treatment_plan_id_fkey(plan_name, currency)",
    )
    .eq("id", appointment.treatment_plan_item_id)
    .is("deleted_at", null)
    .maybeSingle()

  if (itemError || !item) return null

  const [{ count: completedCount }, { data: appointmentSession }, { data: planItems }, { data: planPayments }] =
    await Promise.all([
      supabase
        .from("treatment_sessions")
        .select("id", { count: "exact", head: true })
        .eq("treatment_plan_item_id", item.id)
        .eq("status", "completed")
        .is("deleted_at", null),
      supabase
        .from("treatment_sessions")
        .select("id")
        .eq("appointment_id", appointmentId)
        .eq("treatment_plan_item_id", item.id)
        .eq("status", "completed")
        .is("deleted_at", null)
        .maybeSingle(),
      // Plan-level financials — the payment ledger lives per plan, not per
      // item, so figures are computed over every item/payment in the plan
      // (same rule as `getTreatmentPlanDetail`), not just this one linked
      // item, and grouped per currency (a plan can mix TRY + EUR).
      supabase
        .from("treatment_plan_items")
        .select("total_price, currency")
        .eq("treatment_plan_id", item.treatment_plan_id)
        .is("deleted_at", null),
      supabase
        .from("treatment_payments")
        .select("amount, entry_type, currency")
        .eq("treatment_plan_id", item.treatment_plan_id),
    ])

  const completed = completedCount ?? 0

  const currencyTotals = deriveCurrencyTotals(
    (planItems ?? []).map((row) => ({ currency: row.currency, totalPrice: row.total_price })),
    (planPayments ?? []).map((row) => ({ currency: row.currency, amount: row.amount, entryType: row.entry_type })),
  )

  return {
    treatmentPlanId: item.treatment_plan_id,
    treatmentPlanItemId: item.id,
    planName: item.plan?.plan_name ?? "",
    treatmentName: item.treatment_name,
    providerId: item.provider_id,
    providerName: item.provider?.full_name ?? "",
    sessionCount: item.session_count,
    completedSessions: completed,
    remainingSessions: Math.max(item.session_count - completed, 0),
    itemStatus: item.status,
    hasCompletedSessionForAppointment: appointmentSession !== null,
    currencyTotals,
  }
}

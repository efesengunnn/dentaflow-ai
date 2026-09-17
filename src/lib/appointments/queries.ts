import {
  APPOINTMENTS_PAGE_SIZE,
  type AppointmentActivityType,
  type AppointmentStatus,
} from "@/lib/appointments/constants"
import { sanitizeSearchTerm } from "@/lib/supabase/query-helpers"
import { createClient } from "@/lib/supabase/server"
import { getSeriesRemainingBalances } from "@/lib/treatments/queries"
import type { TreatmentLifecycleStatus } from "@/lib/treatments/constants"

export type AppointmentListFilters = {
  search?: string
  status?: AppointmentStatus
  staffId?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
}

/**
 * Non-null whenever this appointment has a treatment session attached
 * (Sprint 13's "+ Tedavi Tanımla"), regardless of whether that session has
 * since been completed — feeds the "Paket adı / N. Seans" and "Tahsilat
 * Bekliyor" info shown on appointment cards (Sprint 18: Takvim, Liste,
 * Bugünkü Randevular) and the appointment detail page's "Hızlı İşlemler" /
 * completion-suggestion banner. Same shape as `lib/dashboard/queries.ts`'s
 * `DashboardAppointmentRow.linkedTreatment` — kept as one exported type so
 * both modules describe the same thing.
 */
export type AppointmentLinkedTreatment = {
  seriesId: string
  treatmentType: string
  sessionNumber: number
  totalSessions: number
  /** `null` — fee not set yet ("Ücret Belirlenmedi"); never a fake `0`. */
  remainingBalance: number | null
  /** The linked session's own status — lets a consumer tell "still pending" apart from "already completed/cancelled" without a second lookup. */
  sessionStatus: TreatmentLifecycleStatus
}

export type AppointmentListRow = {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  staffId: string
  staffName: string
  reason: string | null
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  createdAt: string
  linkedTreatment: AppointmentLinkedTreatment | null
  /**
   * Sprint 30.3 — the new-system equivalent of `linkedTreatment.treatmentType`:
   * the linked `treatment_plan_items.treatment_name` ("Tanımlanmış Paket"),
   * or `standalone_treatment_name` ("Tek Seans / Tek İşlem") when neither a
   * plan item nor a legacy series is linked. Never both a plan item and
   * standalone name at once (enforced by `appointmentFormSchema`). `null`
   * only for a genuinely treatment-less appointment.
   */
  procedureName: string | null
}

export type AppointmentListResult = {
  rows: AppointmentListRow[]
  total: number
  page: number
  pageSize: number
}

const APPOINTMENT_LIST_SELECT =
  "id, patient_id, staff_id, reason, starts_at, ends_at, status, created_at, standalone_treatment_name, patient:patients!appointments_patient_id_fkey(full_name, phone), provider:staff_members!appointments_staff_id_fkey(full_name), treatments!treatments_appointment_id_fkey(series_id, session_number, status, series:treatment_series(treatment_type, total_sessions)), treatment_plan_item:treatment_plan_items!appointments_treatment_plan_item_id_fkey(treatment_name), appointment_treatment_plan_items(item:treatment_plan_items(treatment_name))"

type RawAppointmentListRow = {
  id: string
  patient_id: string
  staff_id: string
  reason: string | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  created_at: string
  standalone_treatment_name: string | null
  patient: { full_name: string; phone: string } | null
  provider: { full_name: string } | null
  treatments: {
    series_id: string
    session_number: number
    status: TreatmentLifecycleStatus
    series: { treatment_type: string; total_sessions: number } | null
  }[] | null
  treatment_plan_item: { treatment_name: string } | null
  /** Sprint 34 — every plan item this appointment covers (one visit / multiple treatments). */
  appointment_treatment_plan_items: { item: { treatment_name: string } | null }[] | null
}

/**
 * The treatment row tied to this appointment, regardless of its own status
 * (active/completed/cancelled) — only `voided` is excluded, matching the
 * codebase's existing convention that a voided treatment "never represents a
 * real event" (see `TREATMENT_STATUS_OPTIONS`). Deliberately NOT filtered to
 * `status === "active"`: once a linked session is completed (via
 * `completeSession`), it must stay visible on the appointment's own cards —
 * losing the badge/quick-actions the moment a session finishes would be
 * backwards.
 */
function findLinkedTreatment(row: RawAppointmentListRow) {
  return (row.treatments ?? []).find((treatment) => treatment.status !== "voided")
}

function activeLinkedTreatmentSeriesId(row: RawAppointmentListRow): string | null {
  return findLinkedTreatment(row)?.series_id ?? null
}

/**
 * `remainingBalanceBySeriesId` is omitted by callers that don't render the
 * balance-dependent badge/action (export, Patient Card's Randevular list) —
 * those rows simply get `remainingBalance: null`-equivalent-safe
 * `linkedTreatment` info without the extra batched lookup their surface
 * doesn't need.
 */
function mapAppointmentListRow(
  row: RawAppointmentListRow,
  remainingBalanceBySeriesId: Map<string, number | null> = new Map(),
): AppointmentListRow {
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
    patientName: row.patient?.full_name ?? "",
    patientPhone: row.patient?.phone ?? "",
    staffId: row.staff_id,
    staffName: row.provider?.full_name ?? "",
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
    linkedTreatment,
    procedureName: deriveProcedureName(row, linkedTreatment),
  }
}

/**
 * Sprint 34 — an appointment can cover several plan items; show them all
 * (e.g. "Dolgu, Kanal Tedavisi") rather than just one. Falls back to the
 * legacy single plan-item link, then the standalone name, then the legacy
 * series type — the pre-Sprint-34 behaviour for appointments with no junction
 * rows.
 */
function deriveProcedureName(
  row: RawAppointmentListRow,
  linkedTreatment: AppointmentLinkedTreatment | null,
): string | null {
  const names = (row.appointment_treatment_plan_items ?? [])
    .map((link) => link.item?.treatment_name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, "tr"))
  if (names.length > 0) return names.join(", ")
  return row.treatment_plan_item?.treatment_name ?? row.standalone_treatment_name ?? linkedTreatment?.treatmentType ?? null
}

/**
 * Free-text search can't reach the joined `patients` columns through a plain
 * `.or()` string (PostgREST embedded-resource filtering has real syntax
 * limits), so a search term is resolved to a bounded list of matching
 * `patient_id`s first (one small extra round trip, only when `search` is
 * actually used), then combined with a direct `reason` match — mirrors the
 * two-step "resolve a name to an id first" shape already used by Excel
 * import's staff-name resolution.
 */
async function resolveSearchPatientIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  term: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("patients")
    .select("id")
    .is("deleted_at", null)
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
    .limit(200)

  return (data ?? []).map((row) => row.id)
}

export async function getAppointments(
  filters: AppointmentListFilters,
): Promise<AppointmentListResult> {
  const supabase = await createClient()
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const from = (page - 1) * APPOINTMENTS_PAGE_SIZE
  const to = from + APPOINTMENTS_PAGE_SIZE - 1

  let query = supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .range(from, to)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.staffId) query = query.eq("staff_id", filters.staffId)
  if (filters.patientId) query = query.eq("patient_id", filters.patientId)
  if (filters.dateFrom) query = query.gte("starts_at", filters.dateFrom)
  if (filters.dateTo) query = query.lt("starts_at", filters.dateTo)

  const term = filters.search ? sanitizeSearchTerm(filters.search) : ""
  if (term) {
    const patientIds = await resolveSearchPatientIds(supabase, term)
    const orClauses = [`reason.ilike.%${term}%`]
    if (patientIds.length > 0) orClauses.push(`patient_id.in.(${patientIds.join(",")})`)
    query = query.or(orClauses.join(","))
  }

  const { data, count, error } = await query
  if (error) throw error

  const rows = data ?? []
  const seriesIds = rows.map(activeLinkedTreatmentSeriesId).filter((id): id is string => id !== null)
  const balances = await getSeriesRemainingBalances(seriesIds)

  return {
    rows: rows.map((row) => mapAppointmentListRow(row, balances)),
    total: count ?? 0,
    page,
    pageSize: APPOINTMENTS_PAGE_SIZE,
  }
}

/** Same filters as `getAppointments`, no pagination — feeds the Excel export route. */
export async function getAllAppointmentsForExport(
  filters: Pick<AppointmentListFilters, "search" | "status" | "staffId" | "patientId" | "dateFrom" | "dateTo">,
): Promise<AppointmentListRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.staffId) query = query.eq("staff_id", filters.staffId)
  if (filters.patientId) query = query.eq("patient_id", filters.patientId)
  if (filters.dateFrom) query = query.gte("starts_at", filters.dateFrom)
  if (filters.dateTo) query = query.lt("starts_at", filters.dateTo)

  const term = filters.search ? sanitizeSearchTerm(filters.search) : ""
  if (term) {
    const patientIds = await resolveSearchPatientIds(supabase, term)
    const orClauses = [`reason.ilike.%${term}%`]
    if (patientIds.length > 0) orClauses.push(`patient_id.in.(${patientIds.join(",")})`)
    query = query.or(orClauses.join(","))
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => mapAppointmentListRow(row))
}

export type AppointmentDetail = {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  staffId: string
  staffName: string
  reason: string | null
  startsAt: string
  status: AppointmentStatus
  createdAt: string
  updatedAt: string
  /**
   * Just enough to know a treatment is attached and which session it is —
   * Sprint 18's "Hızlı İşlemler" fetches the full `TreatmentSeriesDetail`
   * separately (only for the one series a single appointment page cares
   * about), so this stays a lightweight id/number pair, not the fuller
   * `AppointmentLinkedTreatment` list-card shape.
   */
  linkedTreatment: { seriesId: string; sessionNumber: number } | null
}

export async function getAppointmentById(id: string): Promise<AppointmentDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, staff_id, reason, starts_at, status, created_at, updated_at, patient:patients!appointments_patient_id_fkey(full_name, phone), provider:staff_members!appointments_staff_id_fkey(full_name), treatments!treatments_appointment_id_fkey(series_id, session_number, status)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null

  // Not filtered to `status === "active"` — see `findLinkedTreatment` above:
  // a completed session must stay linked so "Hızlı İşlemler" and the
  // completion-suggestion banner still find it after `completeSession` runs.
  const linkedTreatment = (
    data.treatments as { series_id: string; session_number: number; status: TreatmentLifecycleStatus }[] | null
  )?.find((treatment) => treatment.status !== "voided")

  return {
    id: data.id,
    patientId: data.patient_id,
    patientName: data.patient?.full_name ?? "",
    patientPhone: data.patient?.phone ?? "",
    staffId: data.staff_id,
    staffName: data.provider?.full_name ?? "",
    reason: data.reason,
    startsAt: data.starts_at,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    linkedTreatment: linkedTreatment
      ? { seriesId: linkedTreatment.series_id, sessionNumber: linkedTreatment.session_number }
      : null,
  }
}

export type AppointmentActivityRow = {
  id: string
  activityType: AppointmentActivityType
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
  authorName: string | null
}

export async function getAppointmentActivities(appointmentId: string): Promise<AppointmentActivityRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointment_activities")
    .select(
      "id, activity_type, description, metadata, created_at, author:staff_members!appointment_activities_created_by_fkey(full_name)",
    )
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    activityType: row.activity_type,
    description: row.description,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    authorName: row.author?.full_name ?? null,
  }))
}

/** Feeds Month/Week calendar views (and, via the same rows, the "Bugün" day panel underneath) — one query for the whole visible range, no per-day fetching (no N+1). */
export async function getAppointmentsForCalendarRange(
  from: string,
  to: string,
): Promise<AppointmentListRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT)
    .is("deleted_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true })

  if (error) throw error

  const rows = data ?? []
  const seriesIds = rows.map(activeLinkedTreatmentSeriesId).filter((id): id is string => id !== null)
  const balances = await getSeriesRemainingBalances(seriesIds)

  return rows.map((row) => mapAppointmentListRow(row, balances))
}

/** Feeds Patient Detail's "Randevular" section — most recent/soonest first, small cap (mirrors `RECENT_LIMIT`). */
export async function getAppointmentsForPatient(
  patientId: string,
  limit = 8,
): Promise<AppointmentListRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT)
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) => mapAppointmentListRow(row))
}

/**
 * A control/follow-up ("Kontrol Günü") derived from an appointment's
 * `control_date` — Sprint 31 (founder bug report 2026-09-11: "kontrol tarihini
 * girdiğimde randevu takviminde o tarihte otomatik görünmeli"). Deliberately
 * NOT a real `appointments` row (founder decision, same date): no fake time,
 * no conflict-check pollution, no sync burden if the source changes — it's a
 * pure read-time projection of an existing appointment onto its control day,
 * rendered as a distinct "Kontrol" marker that links back to the source.
 */
export type CalendarControlEntry = {
  /** The appointment this control belongs to — the marker links here. */
  sourceAppointmentId: string
  patientId: string
  patientName: string
  /** Treatment name (plan item or standalone), shown as the marker's subtitle; `null` when the source appointment has no treatment attached. */
  procedureName: string | null
  /** `yyyy-mm-dd` — the day this marker lands on. */
  controlDate: string
}

type RawControlEntryRow = {
  id: string
  patient_id: string
  control_date: string | null
  standalone_treatment_name: string | null
  patient: { full_name: string } | null
  treatment_plan_item: { treatment_name: string } | null
}

/**
 * Control markers whose `control_date` falls in `[from, to)` (both `yyyy-mm-dd`,
 * `to` exclusive — same convention as `getAppointmentsForCalendarRange`).
 * Cancelled and soft-deleted appointments are excluded: a cancelled visit's
 * follow-up is moot. One flat query for the whole visible range, no per-day
 * fetch (same no-N+1 discipline as the calendar's appointment query).
 */
export async function getControlEntriesForCalendarRange(
  from: string,
  to: string,
): Promise<CalendarControlEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, control_date, standalone_treatment_name, patient:patients!appointments_patient_id_fkey(full_name), treatment_plan_item:treatment_plan_items!appointments_treatment_plan_item_id_fkey(treatment_name)",
    )
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .not("control_date", "is", null)
    .gte("control_date", from)
    .lt("control_date", to)
    .order("control_date", { ascending: true })

  if (error) throw error

  return ((data ?? []) as RawControlEntryRow[])
    .filter((row): row is RawControlEntryRow & { control_date: string } => row.control_date !== null)
    .map((row) => ({
      sourceAppointmentId: row.id,
      patientId: row.patient_id,
      patientName: row.patient?.full_name ?? "",
      procedureName: row.treatment_plan_item?.treatment_name ?? row.standalone_treatment_name ?? null,
      controlDate: row.control_date,
    }))
}

export type AppointmentConflict = {
  id: string
  patientName: string
  startsAt: string
}

/**
 * Application-layer conflict guard (founder decision, Sprint 6 planning; no
 * Postgres exclusion constraint / btree_gist extension). Appointments have
 * no duration concept (founder decision, 2026-07-31 — see
 * docs/CHANGELOG.md), so "conflict" is an exact `starts_at` match rather
 * than an interval-overlap test: the same staff member can't have two
 * non-cancelled appointments starting at the exact same instant.
 * `excludeAppointmentId` lets `updateAppointment` re-check without the row
 * conflicting with itself.
 */
export async function findOverlappingAppointment(
  staffId: string,
  startsAtISO: string,
  excludeAppointmentId?: string,
): Promise<AppointmentConflict | null> {
  const supabase = await createClient()

  let query = supabase
    .from("appointments")
    .select("id, starts_at, patient:patients!appointments_patient_id_fkey(full_name)")
    .eq("staff_id", staffId)
    .eq("starts_at", startsAtISO)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .limit(1)

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    patientName: data.patient?.full_name ?? "başka bir hasta",
    startsAt: data.starts_at,
  }
}

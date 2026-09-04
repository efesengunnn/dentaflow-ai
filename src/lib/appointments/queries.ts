import {
  APPOINTMENTS_PAGE_SIZE,
  type AppointmentActivityType,
  type AppointmentStatus,
} from "@/lib/appointments/constants"
import { sanitizeSearchTerm } from "@/lib/supabase/query-helpers"
import { createClient } from "@/lib/supabase/server"

export type AppointmentListFilters = {
  search?: string
  status?: AppointmentStatus
  staffId?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
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
}

export type AppointmentListResult = {
  rows: AppointmentListRow[]
  total: number
  page: number
  pageSize: number
}

const APPOINTMENT_LIST_SELECT =
  "id, patient_id, staff_id, reason, starts_at, ends_at, status, created_at, patient:patients!appointments_patient_id_fkey(full_name, phone), provider:staff_members!appointments_staff_id_fkey(full_name)"

type RawAppointmentListRow = {
  id: string
  patient_id: string
  staff_id: string
  reason: string | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  created_at: string
  patient: { full_name: string; phone: string } | null
  provider: { full_name: string } | null
}

function mapAppointmentListRow(row: RawAppointmentListRow): AppointmentListRow {
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
  }
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

  return {
    rows: (data ?? []).map(mapAppointmentListRow),
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

  return (data ?? []).map(mapAppointmentListRow)
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
}

export async function getAppointmentById(id: string): Promise<AppointmentDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, staff_id, reason, starts_at, status, created_at, updated_at, patient:patients!appointments_patient_id_fkey(full_name, phone), provider:staff_members!appointments_staff_id_fkey(full_name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null

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
  return (data ?? []).map(mapAppointmentListRow)
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
  return (data ?? []).map(mapAppointmentListRow)
}

export type AppointmentConflict = {
  id: string
  patientName: string
  startsAt: string
}

/**
 * Application-layer conflict guard (no Postgres exclusion constraint /
 * btree_gist extension). Appointments have no duration concept, so
 * "conflict" is an exact `starts_at` match rather than an interval-overlap
 * test: the same staff member can't have two non-cancelled appointments
 * starting at the exact same instant. `excludeAppointmentId` lets
 * `updateAppointment` re-check without the row conflicting with itself.
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

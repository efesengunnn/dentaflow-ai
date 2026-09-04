import { PATIENTS_PAGE_SIZE, type PatientActivityType, type PatientOrigin } from "@/lib/patients/constants"
import { sanitizeSearchTerm } from "@/lib/supabase/query-helpers"
import { createClient } from "@/lib/supabase/server"

export type PatientOption = {
  id: string
  fullName: string
  phone: string
}

/**
 * All active patients (id, name, phone), for the Appointment form's patient
 * `Combobox` — same "fetch the whole small list, filter client-side" shape
 * as `getAssignableStaff` (a pilot clinic's patient count is small; a
 * server-side search endpoint is a real future need, not a speculative one
 * now — see docs/ARCHITECTURE.md's Sprint 6 risk note).
 */
export async function getPatientOptions(): Promise<PatientOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, phone")
    .is("deleted_at", null)
    .order("full_name")

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
  }))
}

export type PatientListFilters = {
  search?: string
  origin?: PatientOrigin
  page?: number
}

export type PatientListRow = {
  id: string
  fullName: string
  phone: string
  email: string | null
  leadId: string | null
  createdAt: string
}

export type PatientListResult = {
  rows: PatientListRow[]
  total: number
  page: number
  pageSize: number
}

const PATIENT_LIST_SELECT = "id, full_name, phone, email, lead_id, created_at"

function mapPatientListRow(row: {
  id: string
  full_name: string
  phone: string
  email: string | null
  lead_id: string | null
  created_at: string
}): PatientListRow {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    leadId: row.lead_id,
    createdAt: row.created_at,
  }
}

export async function getPatients(filters: PatientListFilters): Promise<PatientListResult> {
  const supabase = await createClient()
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const from = (page - 1) * PATIENTS_PAGE_SIZE
  const to = from + PATIENTS_PAGE_SIZE - 1

  let query = supabase
    .from("patients")
    .select(PATIENT_LIST_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  const term = filters.search ? sanitizeSearchTerm(filters.search) : ""
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filters.origin === "converted") {
    query = query.not("lead_id", "is", null)
  } else if (filters.origin === "direct") {
    query = query.is("lead_id", null)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    rows: (data ?? []).map(mapPatientListRow),
    total: count ?? 0,
    page,
    pageSize: PATIENTS_PAGE_SIZE,
  }
}

/**
 * Export-only row shape — a deliberate second select/type, not a reuse of
 * `PATIENT_LIST_SELECT`/`PatientListRow`: `tcKimlikNo`/`dateOfBirth` must
 * never leak into the on-screen list (application-layer discipline, see
 * docs/DATABASE.md), only into the Excel export a staff member explicitly
 * requests.
 */
export type PatientExportRow = {
  id: string
  fullName: string
  phone: string
  email: string | null
  tcKimlikNo: string | null
  dateOfBirth: string | null
  leadId: string | null
}

const PATIENT_EXPORT_SELECT = "id, full_name, phone, email, tc_kimlik_no, date_of_birth, lead_id"

function mapPatientExportRow(row: {
  id: string
  full_name: string
  phone: string
  email: string | null
  tc_kimlik_no: string | null
  date_of_birth: string | null
  lead_id: string | null
}): PatientExportRow {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    tcKimlikNo: row.tc_kimlik_no,
    dateOfBirth: row.date_of_birth,
    leadId: row.lead_id,
  }
}

/** Same filters as `getPatients`, no pagination — feeds the Excel export route. */
export async function getAllPatientsForExport(
  filters: Pick<PatientListFilters, "search" | "origin">,
): Promise<PatientExportRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from("patients")
    .select(PATIENT_EXPORT_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const term = filters.search ? sanitizeSearchTerm(filters.search) : ""
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filters.origin === "converted") {
    query = query.not("lead_id", "is", null)
  } else if (filters.origin === "direct") {
    query = query.is("lead_id", null)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapPatientExportRow)
}

export type PatientDetail = {
  id: string
  fullName: string
  phone: string
  email: string | null
  tcKimlikNo: string | null
  dateOfBirth: string | null
  leadId: string | null
  createdAt: string
  updatedAt: string
}

export async function getPatientById(id: string): Promise<PatientDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, phone, email, tc_kimlik_no, date_of_birth, lead_id, created_at, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    email: data.email,
    tcKimlikNo: data.tc_kimlik_no,
    dateOfBirth: data.date_of_birth,
    leadId: data.lead_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export type PatientDuplicateMatch = {
  id: string
  fullName: string
}

/**
 * Non-blocking duplicate check for the Yeni Hasta form — matches on exact
 * phone (the only reliable signal; `patients.phone` has no unique
 * constraint by design, see docs/DATABASE.md, so this is a soft warning,
 * never an insert-time rejection). The user can always proceed anyway.
 */
export async function findPatientByPhone(phone: string): Promise<PatientDuplicateMatch | null> {
  if (!/^\d{10}$/.test(phone)) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("phone", phone)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle()

  return data ? { id: data.id, fullName: data.full_name } : null
}

export type PatientActivityRow = {
  id: string
  activityType: PatientActivityType
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
  authorName: string | null
}

export async function getPatientActivities(patientId: string): Promise<PatientActivityRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patient_activities")
    .select(
      "id, activity_type, description, metadata, created_at, author:staff_members!patient_activities_created_by_fkey(full_name)",
    )
    .eq("patient_id", patientId)
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

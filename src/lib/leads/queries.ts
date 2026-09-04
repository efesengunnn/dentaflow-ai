import { sanitizeSearchTerm } from "@/lib/supabase/query-helpers"
import { createClient } from "@/lib/supabase/server"
import type { LeadSource, LeadStatus } from "@/lib/leads/constants"
import { LEADS_PAGE_SIZE } from "@/lib/leads/constants"

export type LeadListFilters = {
  search?: string
  status?: LeadStatus
  assignedTo?: string
  page?: number
}

export type LeadListRow = {
  id: string
  fullName: string
  phone: string
  email: string | null
  source: LeadSource
  status: LeadStatus
  assignedToId: string | null
  assignedToName: string | null
  createdAt: string
}

export type LeadListResult = {
  rows: LeadListRow[]
  total: number
  page: number
  pageSize: number
}

const LEAD_LIST_SELECT =
  "id, full_name, phone, email, source, status, assigned_to, created_at, assigned_staff:staff_members!leads_assigned_to_fkey(full_name)"

function mapLeadListRow(row: {
  id: string
  full_name: string
  phone: string
  email: string | null
  source: LeadSource
  status: LeadStatus
  assigned_to: string | null
  created_at: string
  assigned_staff: { full_name: string } | null
}): LeadListRow {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    status: row.status,
    assignedToId: row.assigned_to,
    assignedToName: row.assigned_staff?.full_name ?? null,
    createdAt: row.created_at,
  }
}

export async function getLeads(filters: LeadListFilters): Promise<LeadListResult> {
  const supabase = await createClient()
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const from = (page - 1) * LEADS_PAGE_SIZE
  const to = from + LEADS_PAGE_SIZE - 1

  let query = supabase
    .from("leads")
    .select(LEAD_LIST_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  const term = filters.search ? sanitizeSearchTerm(filters.search) : ""
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filters.status) {
    query = query.eq("status", filters.status)
  }
  if (filters.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    rows: (data ?? []).map(mapLeadListRow),
    total: count ?? 0,
    page,
    pageSize: LEADS_PAGE_SIZE,
  }
}

/**
 * Same filters as `getLeads`, no pagination — used by the Excel export
 * route, which needs every matching row, not one page. Deliberately not
 * reusing a shared "apply filters" helper: chaining query-builder calls
 * through a narrowed generic type fights Supabase's real
 * `PostgrestFilterBuilder` type more than the ~10 duplicated lines cost.
 */
export async function getAllLeadsForExport(
  filters: Pick<LeadListFilters, "search" | "status" | "assignedTo">,
): Promise<LeadListRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from("leads")
    .select(LEAD_LIST_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const term = filters.search ? sanitizeSearchTerm(filters.search) : ""
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filters.status) {
    query = query.eq("status", filters.status)
  }
  if (filters.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapLeadListRow)
}

export type LeadDetail = {
  id: string
  fullName: string
  phone: string
  email: string | null
  source: LeadSource
  status: LeadStatus
  assignedToId: string | null
  assignedToName: string | null
  createdAt: string
  updatedAt: string
}

export async function getLeadById(id: string): Promise<LeadDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, full_name, phone, email, source, status, assigned_to, created_at, updated_at, assigned_staff:staff_members!leads_assigned_to_fkey(full_name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    email: data.email,
    source: data.source,
    status: data.status,
    assignedToId: data.assigned_to,
    assignedToName: data.assigned_staff?.full_name ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export type LeadActivityRow = {
  id: string
  activityType: Database_LeadActivityType
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
  authorName: string | null
}

// Local alias to avoid importing the generated Database type just for this
// one enum reference in this file's public surface.
type Database_LeadActivityType =
  | "lead_created"
  | "lead_updated"
  | "status_changed"
  | "note_added"
  | "lead_deleted"

export async function getLeadActivities(leadId: string): Promise<LeadActivityRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_activities")
    .select(
      "id, activity_type, description, metadata, created_at, author:staff_members!lead_activities_created_by_fkey(full_name)",
    )
    .eq("lead_id", leadId)
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


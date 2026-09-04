import { Download, Plus } from "lucide-react"
import Link from "next/link"

import { LeadFilters } from "@/components/leads/lead-filters"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"
import { LeadTableSection } from "@/components/leads/lead-table-section"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import type { LeadStatus } from "@/lib/leads/constants"
import { getLeads } from "@/lib/leads/queries"
import { getAssignableStaff } from "@/lib/staff/queries"

type LeadsPageProps = {
  searchParams: Promise<{
    search?: string
    status?: string
    assignedTo?: string
    page?: string
  }>
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams
  const page = params.page ? Number.parseInt(params.page, 10) || 1 : 1

  // All three round trips are independent (RLS scopes getLeads/getAssignableStaff
  // server-side, not from staffMember) — running them in parallel instead of
  // awaiting staffMember first cuts one full Supabase round trip off every
  // page load.
  const [staffMember, { rows, total, pageSize }, staffOptions] = await Promise.all([
    getCurrentStaffMember(),
    getLeads({
      search: params.search,
      status: params.status as LeadStatus | undefined,
      assignedTo: params.assignedTo,
      page,
    }),
    getAssignableStaff(),
  ])
  const canManageLeads = staffMember?.role !== "doctor"

  const exportParams = new URLSearchParams()
  if (params.search) exportParams.set("search", params.search)
  if (params.status) exportParams.set("status", params.status)
  if (params.assignedTo) exportParams.set("assignedTo", params.assignedTo)
  const exportHref = `/leads/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`

  return (
    <PageContainer>
      <PageHeader
        title="Potansiyel Müşteriler"
        description="Gelen talepleri tek bir yerden takip edin ve hastaya dönüştürün."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download />
                Dışa Aktar
              </a>
            </Button>
            {canManageLeads && (
              <>
                <LeadImportDialog />
                <Button asChild>
                  <Link href="/leads/new">
                    <Plus />
                    Yeni Potansiyel Müşteri
                  </Link>
                </Button>
              </>
            )}
          </div>
        }
      />
      <LeadFilters staffOptions={staffOptions} />
      <LeadTableSection rows={rows} total={total} page={page} pageSize={pageSize} />
    </PageContainer>
  )
}

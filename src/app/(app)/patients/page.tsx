import { Download, Plus } from "lucide-react"
import Link from "next/link"

import { PatientFilters } from "@/components/patients/patient-filters"
import { PatientImportDialog } from "@/components/patients/patient-import-dialog"
import { PatientTableSection } from "@/components/patients/patient-table-section"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatients } from "@/lib/patients/queries"

type PatientsPageProps = {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const params = await searchParams
  const page = params.page ? Number.parseInt(params.page, 10) || 1 : 1

  const [staffMember, { rows, total, pageSize }] = await Promise.all([
    getCurrentStaffMember(),
    getPatients({
      search: params.search,
      page,
    }),
  ])
  const canManagePatients = staffMember?.role !== "doctor"
  const isOwner = staffMember?.role === "owner"

  const exportParams = new URLSearchParams()
  if (params.search) exportParams.set("search", params.search)
  const exportHref = `/patients/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`

  return (
    <PageContainer>
      <PageHeader
        title="Hastalar"
        description="Hasta kayıtlarına ve geçmişine buradan ulaşın."
        actions={
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button variant="outline" asChild>
                <a href={exportHref}>
                  <Download />
                  Dışa Aktar
                </a>
              </Button>
            )}
            {isOwner && <PatientImportDialog />}
            {canManagePatients && (
              <Button asChild>
                <Link href="/patients/new">
                  <Plus />
                  Yeni Hasta
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <PatientFilters />
      <PatientTableSection rows={rows} total={total} page={page} pageSize={pageSize} />
    </PageContainer>
  )
}

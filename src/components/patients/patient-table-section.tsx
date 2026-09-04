"use client"

import { UsersRound } from "lucide-react"

import { EntityTableSection } from "@/components/shared/entity-table-section"
import type { PatientListRow } from "@/lib/patients/queries"
import { PatientCard } from "./patient-card"
import { patientColumns } from "./patient-columns"

type PatientTableSectionProps = {
  rows: PatientListRow[]
  total: number
  page: number
  pageSize: number
}

function PatientTableSection({ rows, total, page, pageSize }: PatientTableSectionProps) {
  return (
    <EntityTableSection
      columns={patientColumns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      getRowHref={(patient) => `/patients/${patient.id}`}
      renderCard={(patient) => <PatientCard patient={patient} />}
      emptyIcon={UsersRound}
      emptyTitle="Henüz hasta yok"
      emptyDescription="İlk hasta kaydınızı oluşturduğunuzda burada listelenmeye başlayacak."
    />
  )
}

export { PatientTableSection }

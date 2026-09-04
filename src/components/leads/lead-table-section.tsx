"use client"

import { UsersRound } from "lucide-react"

import { EntityTableSection } from "@/components/shared/entity-table-section"
import type { LeadListRow } from "@/lib/leads/queries"
import { LeadCard } from "./lead-card"
import { leadColumns } from "./lead-columns"

type LeadTableSectionProps = {
  rows: LeadListRow[]
  total: number
  page: number
  pageSize: number
}

function LeadTableSection({ rows, total, page, pageSize }: LeadTableSectionProps) {
  return (
    <EntityTableSection
      columns={leadColumns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      getRowHref={(lead) => `/leads/${lead.id}`}
      renderCard={(lead) => <LeadCard lead={lead} />}
      emptyIcon={UsersRound}
      emptyTitle="Henüz kayıt yok"
      emptyDescription="İlk potansiyel müşteri kaydınızı oluşturduğunuzda burada listelenmeye başlayacak."
    />
  )
}

export { LeadTableSection }

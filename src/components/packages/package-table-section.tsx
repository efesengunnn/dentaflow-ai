"use client"

import { Package } from "lucide-react"

import { EntityTableSection } from "@/components/shared/entity-table-section"
import type { TreatmentPlanListRow } from "@/lib/treatment-plans/queries"
import { PackageCard } from "./package-card"
import { packageColumns } from "./package-columns"

function PackageTableSection({ rows }: { rows: TreatmentPlanListRow[] }) {
  return (
    <EntityTableSection
      columns={packageColumns}
      rows={rows}
      total={rows.length}
      page={1}
      pageSize={Math.max(rows.length, 1)}
      getRowHref={(plan) => `/packages/${plan.id}`}
      renderCard={(plan) => <PackageCard plan={plan} />}
      emptyIcon={Package}
      emptyTitle="Henüz paket yok"
      emptyDescription="Bir hastaya paket/tedavi tanımladığınızda burada listelenmeye başlayacak."
    />
  )
}

export { PackageTableSection }

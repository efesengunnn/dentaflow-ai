"use client"

import { useState } from "react"

import type { ToothConditionRow, ToothTreatmentRow } from "@/lib/teeth/queries"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { ToothChart } from "./tooth-chart"
import { ToothDetailSheet } from "./tooth-detail-sheet"

type DentalChartSectionProps = {
  patientId: string
  conditions: Map<number, ToothConditionRow>
  treatments: ToothTreatmentRow[]
  staffOptions: AssignableStaff[]
  catalog: CatalogItem[]
  canManageClinical: boolean
}

function DentalChartSection({
  patientId,
  conditions,
  treatments,
  staffOptions,
  catalog,
  canManageClinical,
}: DentalChartSectionProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  return (
    <>
      <ToothChart conditions={conditions} onToothClick={setSelectedTooth} selectedTooth={selectedTooth} />

      {selectedTooth !== null && (
        <ToothDetailSheet
          open={selectedTooth !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedTooth(null)
          }}
          patientId={patientId}
          toothNumber={selectedTooth}
          condition={conditions.get(selectedTooth)}
          treatments={treatments}
          staffOptions={staffOptions}
          catalog={catalog}
          canManageClinical={canManageClinical}
        />
      )}
    </>
  )
}

export { DentalChartSection }

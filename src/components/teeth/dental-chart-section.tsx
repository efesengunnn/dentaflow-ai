"use client"

import { CheckSquare, Plus, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { ToothConditionRow, ToothTreatmentRow } from "@/lib/teeth/queries"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { MultiToothTreatmentSheet } from "./multi-tooth-treatment-sheet"
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
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedTeeth, setSelectedTeeth] = useState<Set<number>>(new Set())
  const [multiTreatmentOpen, setMultiTreatmentOpen] = useState(false)

  function handleToothClick(toothNumber: number) {
    if (!multiSelectMode) {
      setSelectedTooth(toothNumber)
      return
    }
    setSelectedTeeth((current) => {
      const next = new Set(current)
      if (next.has(toothNumber)) next.delete(toothNumber)
      else next.add(toothNumber)
      return next
    })
  }

  function exitMultiSelect() {
    setMultiSelectMode(false)
    setSelectedTeeth(new Set())
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {multiSelectMode ? `${selectedTeeth.size} diş seçildi` : "Birden fazla dişe aynı işlemi eklemek için:"}
        </span>
        {multiSelectMode ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={exitMultiSelect}>
              <X />
              Vazgeç
            </Button>
            {canManageClinical && (
              <Button size="sm" disabled={selectedTeeth.size === 0} onClick={() => setMultiTreatmentOpen(true)}>
                <Plus />
                Tedavi Ekle
              </Button>
            )}
          </div>
        ) : (
          canManageClinical && (
            <Button size="sm" variant="outline" onClick={() => setMultiSelectMode(true)}>
              <CheckSquare />
              Çoklu Diş Seç
            </Button>
          )
        )}
      </div>

      <ToothChart
        conditions={conditions}
        onToothClick={handleToothClick}
        selectedTooth={selectedTooth}
        multiSelectedTeeth={multiSelectMode ? selectedTeeth : undefined}
      />

      {selectedTooth !== null && !multiSelectMode && (
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

      <MultiToothTreatmentSheet
        open={multiTreatmentOpen}
        onOpenChange={setMultiTreatmentOpen}
        patientId={patientId}
        toothNumbers={Array.from(selectedTeeth)}
        staffOptions={staffOptions}
        catalog={catalog}
        onSuccess={() => {
          setMultiTreatmentOpen(false)
          exitMultiSelect()
        }}
      />
    </>
  )
}

export { DentalChartSection }

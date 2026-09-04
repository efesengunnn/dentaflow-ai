"use client"

import { useRouter } from "next/navigation"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createToothTreatmentsForTeeth } from "@/lib/teeth/actions"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { ToothTreatmentForm } from "./tooth-treatment-form"

type MultiToothTreatmentSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  toothNumbers: number[]
  staffOptions: AssignableStaff[]
  catalog: CatalogItem[]
  onSuccess: () => void
}

/**
 * Same procedure applied to several teeth in one submission — the tooth
 * chart's multi-select "Tedavi Ekle" action, for the common case of doing
 * the same thing (e.g. two fillings) on more than one tooth in a visit.
 * Reuses `ToothTreatmentForm` as-is: it never renders a tooth-number field,
 * so the only difference from the single-tooth flow is which action the
 * submit routes to.
 */
function MultiToothTreatmentSheet({
  open,
  onOpenChange,
  patientId,
  toothNumbers,
  staffOptions,
  catalog,
  onSuccess,
}: MultiToothTreatmentSheetProps) {
  const router = useRouter()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{toothNumbers.length} Diş İçin Tedavi Ekle</SheetTitle>
          <SheetDescription>
            Diş {toothNumbers.slice().sort((a, b) => a - b).join(", ")} için aynı işlem kaydedilecek.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <ToothTreatmentForm
            toothNumber={toothNumbers[0] ?? 0}
            staffOptions={staffOptions}
            catalog={catalog}
            onSubmit={(values) => createToothTreatmentsForTeeth(patientId, toothNumbers, values)}
            onSuccess={() => {
              onSuccess()
              router.refresh()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { MultiToothTreatmentSheet }

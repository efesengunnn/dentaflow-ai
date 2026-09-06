"use client"

import { useState } from "react"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { TreatmentActionState } from "@/lib/treatments/actions"
import type { AssignableStaff } from "@/lib/staff/queries"
import { StandaloneTreatmentForm } from "./standalone-treatment-form"
import { TreatmentSeriesForm } from "./treatment-series-form"

type TreatmentEntryFormProps = {
  patientId: string
  staffOptions: AssignableStaff[]
  defaultAppointmentId?: string
  defaultStaffId?: string
  defaultTreatmentDate?: string
  onSuccess?: (state: Extract<TreatmentActionState, { success: true }>) => void
}

/**
 * "Tedavi Ekle" — one entry point, first question is Tek Seans/Paket
 * (Sprint 8 UX decision), not two separate buttons. The toggle only swaps
 * which existing form renders — `StandaloneTreatmentForm`/
 * `TreatmentSeriesForm` and their Server Actions are unchanged, so this is
 * purely a presentation-layer merge, not a new data path.
 */
function TreatmentEntryForm({
  patientId,
  staffOptions,
  defaultAppointmentId,
  defaultStaffId,
  defaultTreatmentDate,
  onSuccess,
}: TreatmentEntryFormProps) {
  const [mode, setMode] = useState<"single" | "package">("single")

  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        value={mode}
        onValueChange={(value) => setMode(value as "single" | "package")}
        className="grid-cols-2"
      >
        <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors duration-150 hover:bg-muted/40 has-[[data-checked]]:border-primary">
          <RadioGroupItem value="single" />
          Tek Seans
        </Label>
        <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors duration-150 hover:bg-muted/40 has-[[data-checked]]:border-primary">
          <RadioGroupItem value="package" />
          Paket
        </Label>
      </RadioGroup>

      {mode === "single" ? (
        <StandaloneTreatmentForm
          patientId={patientId}
          staffOptions={staffOptions}
          defaultAppointmentId={defaultAppointmentId}
          defaultStaffId={defaultStaffId}
          defaultTreatmentDate={defaultTreatmentDate}
          onSuccess={onSuccess}
        />
      ) : (
        <TreatmentSeriesForm patientId={patientId} onSuccess={onSuccess} />
      )}
    </div>
  )
}

export { TreatmentEntryForm }

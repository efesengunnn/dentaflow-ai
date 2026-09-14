"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { createTreatmentSeries, type TreatmentActionState } from "@/lib/treatments/actions"
import {
  treatmentSeriesFormDefaults,
  treatmentSeriesFormSchema,
  type TreatmentSeriesFormValues,
} from "@/lib/treatments/schema"

type TreatmentSeriesFormProps = {
  patientId: string
  onSuccess?: (state: Extract<TreatmentActionState, { success: true }>) => void
}

/** "Yeni Paket Oluştur" — a treatment_series with no session yet; a real package can be sold and paid before its first visit. */
function TreatmentSeriesForm({ patientId, onSuccess }: TreatmentSeriesFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<TreatmentSeriesFormValues>({
    resolver: zodResolver(treatmentSeriesFormSchema),
    defaultValues: { ...treatmentSeriesFormDefaults, patientId },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await createTreatmentSeries(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof TreatmentSeriesFormValues, { message })
          }
        }
        return
      }
      toast.success("Paket oluşturuldu.")
      if (result?.success) onSuccess?.(result)
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <FormField
          control={form.control}
          name="treatmentType"
          label="Tedavi Türü"
          render={({ field }) => <Input {...field} placeholder="Örn. Kanal tedavisi" />}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="totalSessions"
            label="Toplam Seans"
            render={({ field }) => (
              <Input
                type="number"
                min={1}
                value={field.value}
                onChange={(event) => field.onChange(event.target.valueAsNumber)}
              />
            )}
          />
          <FormField
            control={form.control}
            name="totalFee"
            label="Paket Ücreti (opsiyonel)"
            render={({ field }) => (
              <MoneyInput value={field.value} onChange={field.onChange} placeholder="Belirlenmedi" />
            )}
          />
        </div>
      </FieldGroup>

      {/* Sticky action bar — see `PatientForm`'s identical treatment. */}
      <div className="bg-card sticky bottom-0 flex flex-col gap-3 border-t pt-4 pb-1">
        <FormError message={formError} />
        <Button type="submit" loading={isPending} className="w-full sm:w-fit">
          Paket Oluştur
        </Button>
      </div>
    </form>
  )
}

export { TreatmentSeriesForm }

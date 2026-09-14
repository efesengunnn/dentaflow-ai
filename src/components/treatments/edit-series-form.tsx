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
import { updateTreatmentSeries, type TreatmentActionState } from "@/lib/treatments/actions"
import {
  updateTreatmentSeriesSchema,
  type UpdateTreatmentSeriesValues,
} from "@/lib/treatments/schema"

type EditSeriesFormProps = {
  seriesId: string
  treatmentType: string
  totalSessions: number
  totalFee: number | null
  onSuccess?: (state: Extract<TreatmentActionState, { success: true }>) => void
}

/** "Paketi Düzenle" (Sprint 8) — every change is logged with old→new value, see `updateTreatmentSeries`. */
function EditSeriesForm({ seriesId, treatmentType, totalSessions, totalFee, onSuccess }: EditSeriesFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<UpdateTreatmentSeriesValues>({
    resolver: zodResolver(updateTreatmentSeriesSchema),
    defaultValues: { seriesId, treatmentType, totalSessions, totalFee: totalFee ?? undefined },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await updateTreatmentSeries(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof UpdateTreatmentSeriesValues, { message })
          }
        }
        return
      }
      toast.success("Paket güncellendi.")
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

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        Kaydet
      </Button>
    </form>
  )
}

export { EditSeriesForm }

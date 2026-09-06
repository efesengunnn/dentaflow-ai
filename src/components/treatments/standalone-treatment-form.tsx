"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { CollapsibleToggleTrigger } from "@/components/shared/collapsible-toggle-trigger"
import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Combobox } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createStandaloneTreatment, type TreatmentActionState } from "@/lib/treatments/actions"
import { TREATMENT_SESSION_STATUS_OPTIONS } from "@/lib/treatments/constants"
import {
  standaloneTreatmentFormDefaults,
  standaloneTreatmentFormSchema,
  type StandaloneTreatmentFormValues,
} from "@/lib/treatments/schema"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import type { AssignableStaff } from "@/lib/staff/queries"

type StandaloneTreatmentFormProps = {
  patientId: string
  staffOptions: AssignableStaff[]
  defaultAppointmentId?: string
  defaultStaffId?: string
  defaultTreatmentDate?: string
  onSuccess?: (state: Extract<TreatmentActionState, { success: true }>) => void
}

/** "Yeni Tedavi" (tek seferlik) — creates an invisible size-1 series and its one session together; the user never sees "series" language here. */
function StandaloneTreatmentForm({
  patientId,
  staffOptions,
  defaultAppointmentId,
  defaultStaffId,
  defaultTreatmentDate,
  onSuccess,
}: StandaloneTreatmentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<StandaloneTreatmentFormValues>({
    resolver: zodResolver(standaloneTreatmentFormSchema),
    defaultValues: {
      ...standaloneTreatmentFormDefaults,
      patientId,
      appointmentId: defaultAppointmentId ?? "",
      staffId: defaultStaffId ?? "",
      treatmentDate: defaultTreatmentDate ?? "",
    },
  })

  const staffComboOptions = staffOptions.map((staff) => ({ value: staff.id, label: staff.fullName }))

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await createStandaloneTreatment(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof StandaloneTreatmentFormValues, { message })
          }
        }
        return
      }
      toast.success("Tedavi kaydı oluşturuldu.")
      if (result?.success) onSuccess?.(result)
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <FormField
          control={form.control}
          name="staffId"
          label="İşlemi Yapan Personel"
          render={({ field }) => (
            <Combobox
              options={staffComboOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder="Personel seçin"
            />
          )}
        />
        <FormField
          control={form.control}
          name="treatmentType"
          label="Tedavi Türü"
          render={({ field }) => <Input {...field} placeholder="Örn. Botoks" />}
        />
        <FormField
          control={form.control}
          name="treatmentDate"
          label="Tedavi Tarihi"
          render={({ field }) => (
            <DatePicker
              value={dateStringToLocalDate(field.value)}
              onChange={(date) => field.onChange(localDateToDateString(date))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="totalFee"
          label="Ücret (opsiyonel)"
          render={({ field }) => (
            <MoneyInput value={field.value} onChange={field.onChange} placeholder="Belirlenmedi" />
          )}
        />
        <FormField
          control={form.control}
          name="status"
          label="Durum"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_SESSION_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />

        <Collapsible>
          <CollapsibleToggleTrigger>Diğer Bilgiler (opsiyonel)</CollapsibleToggleTrigger>
          <CollapsibleContent className="flex flex-col gap-6 pt-4">
            <FormField
              control={form.control}
              name="controlDate"
              label="Kontrol Tarihi"
              render={({ field }) => (
                <DatePicker
                  value={dateStringToLocalDate(field.value)}
                  onChange={(date) => field.onChange(localDateToDateString(date))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              label="Açıklama"
              render={({ field }) => (
                <Textarea {...field} rows={3} placeholder="Bu tedavi hakkında kısa bir açıklama..." />
              )}
            />
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        Oluştur
      </Button>
    </form>
  )
}

export { StandaloneTreatmentForm }

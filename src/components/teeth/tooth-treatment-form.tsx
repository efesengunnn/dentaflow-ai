"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ToothActionState } from "@/lib/teeth/actions"
import { TOOTH_TREATMENT_STATUS_OPTIONS, TOOTH_TREATMENT_TYPE_OPTIONS } from "@/lib/teeth/constants"
import {
  toothTreatmentFormDefaults,
  toothTreatmentFormSchema,
  type ToothTreatmentFormValues,
} from "@/lib/teeth/schema"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import type { AssignableStaff } from "@/lib/staff/queries"

type ToothTreatmentFormProps = {
  toothNumber: number
  staffOptions: AssignableStaff[]
  catalog: CatalogItem[]
  onSubmit: (values: ToothTreatmentFormValues) => Promise<ToothActionState>
  onSuccess?: () => void
}

function ToothTreatmentForm({ toothNumber, staffOptions, catalog, onSubmit, onSuccess }: ToothTreatmentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(undefined)

  const form = useForm<ToothTreatmentFormValues>({
    resolver: zodResolver(toothTreatmentFormSchema),
    defaultValues: {
      ...toothTreatmentFormDefaults,
      toothNumber,
      performedAt: localDateToDateString(new Date()),
    },
  })

  const treatmentType = form.watch("treatmentType")
  const staffComboOptions = staffOptions.map((staff) => ({ value: staff.id, label: staff.fullName }))

  function handleCatalogSelect(value: string) {
    setSelectedCatalogId(value)
    const item = catalog.find((entry) => entry.id === value)
    if (!item) return
    form.setValue("treatmentType", item.treatmentType)
    if (item.defaultPrice !== null) form.setValue("price", item.defaultPrice)
  }

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await onSubmit(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof ToothTreatmentFormValues, { message })
          }
        }
        return
      }
      toast.success("Tedavi kaydedildi.")
      onSuccess?.()
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        {catalog.length > 0 && (
          <Combobox
            options={catalog.map((item) => ({
              value: item.id,
              label:
                item.defaultPrice !== null
                  ? `${item.name} · ${item.defaultPrice.toLocaleString("tr-TR")} TRY`
                  : item.name,
            }))}
            value={selectedCatalogId}
            onChange={handleCatalogSelect}
            placeholder="Kayıtlı işlemlerden seçin"
            searchPlaceholder="İşlem ara..."
          />
        )}
        <FormField
          control={form.control}
          name="treatmentType"
          label="İşlem Türü"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOOTH_TREATMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {treatmentType === "diger" && (
          <FormField
            control={form.control}
            name="customTreatmentName"
            label="İşlem Adı"
            render={({ field }) => <Input {...field} placeholder="Örn. Gülüş tasarımı konsültasyonu" />}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  {TOOTH_TREATMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            label="Ücret (opsiyonel)"
            render={({ field }) => (
              <MoneyInput value={field.value} onChange={field.onChange} placeholder="Belirlenmedi" />
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="performedBy"
          label="Sağlayıcı"
          render={({ field }) => (
            <Combobox
              options={staffComboOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder="Sağlayıcı seçin"
            />
          )}
        />
        <FormField
          control={form.control}
          name="performedAt"
          label="Tarih"
          render={({ field }) => (
            <DatePicker
              value={dateStringToLocalDate(field.value)}
              onChange={(date) => field.onChange(localDateToDateString(date))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="note"
          label="Not (opsiyonel)"
          render={({ field }) => <Textarea {...field} rows={3} placeholder="Bu işlem hakkında kısa bir not..." />}
        />
      </FieldGroup>

      <div className="bg-card sticky bottom-0 flex flex-col gap-3 border-t pt-4 pb-1">
        <FormError message={formError} />
        <Button type="submit" loading={isPending} className="w-full sm:w-fit">
          Kaydet
        </Button>
      </div>
    </form>
  )
}

export { ToothTreatmentForm }

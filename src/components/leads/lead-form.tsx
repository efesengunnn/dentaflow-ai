"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { ContactFormFields } from "@/components/shared/contact-form-fields"
import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { LeadActionState } from "@/lib/leads/actions"
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS } from "@/lib/leads/constants"
import type { AssignableStaff } from "@/lib/staff/queries"
import { leadFormDefaults, leadFormSchema, type LeadFormValues } from "@/lib/leads/schema"

type LeadFormProps = {
  mode: "create" | "edit"
  defaultValues?: Partial<LeadFormValues>
  staffOptions: AssignableStaff[]
  onSubmit: (values: LeadFormValues) => Promise<LeadActionState>
  onSuccess?: () => void
  submitLabel?: string
}

function LeadForm({
  mode,
  defaultValues,
  staffOptions,
  onSubmit,
  onSuccess,
  submitLabel,
}: LeadFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { ...leadFormDefaults, ...defaultValues },
  })

  const staffComboOptions = staffOptions.map((staff) => ({
    value: staff.id,
    label: staff.fullName,
  }))

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await onSubmit(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof LeadFormValues, { message })
          }
        }
        return
      }
      toast.success(
        mode === "create" ? "Potansiyel müşteri oluşturuldu." : "Potansiyel müşteri güncellendi.",
      )
      onSuccess?.()
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <ContactFormFields control={form.control} />
        <FormField
          control={form.control}
          name="source"
          label="Kaynak"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_OPTIONS.map((option) => (
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
          name="status"
          label="Durum"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_OPTIONS.map((option) => (
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
          name="assignedTo"
          label="Sorumlu Personel (opsiyonel)"
          description="Boş bırakılırsa kayıt atanmamış olarak kalır."
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
          name="note"
          label={mode === "create" ? "Not (opsiyonel)" : "Yeni not ekle (opsiyonel)"}
          render={({ field }) => (
            <Textarea
              {...field}
              rows={3}
              placeholder="Bu potansiyel müşteri hakkında kısa bir not..."
            />
          )}
        />
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        {submitLabel ?? (mode === "create" ? "Oluştur" : "Kaydet")}
      </Button>
    </form>
  )
}

export { LeadForm }

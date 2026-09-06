"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { CollapsibleToggleTrigger } from "@/components/shared/collapsible-toggle-trigger"
import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { DatePicker } from "@/components/ui/date-picker"
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
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import { completeTreatmentSession, type SessionActionState } from "@/lib/treatment-plans/actions"
import { completeSessionFormSchema, type CompleteSessionFormValues } from "@/lib/treatment-plans/schema"
import type { AssignableStaff } from "@/lib/staff/queries"

type CompleteSessionFormProps = {
  treatmentPlanItemId: string
  appointmentId?: string
  nextSessionNumber: number
  staffOptions: AssignableStaff[]
  defaultStaffId: string
  onSuccess?: (state: Extract<SessionActionState, { success: true }>) => void
}

/**
 * "Seansı Tamamla" — Sprint 28D. Zero required input beyond who performed it
 * and when (both pre-filled: current user, today) — `session_number` is
 * never collected here, it's always server-derived. Notes/control date stay
 * behind a collapsible, same "don't ask for what isn't needed" pattern as
 * the legacy `SessionForm`.
 */
function CompleteSessionForm({
  treatmentPlanItemId,
  appointmentId,
  nextSessionNumber,
  staffOptions,
  defaultStaffId,
  onSuccess,
}: CompleteSessionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<CompleteSessionFormValues>({
    resolver: zodResolver(completeSessionFormSchema),
    defaultValues: {
      treatmentPlanItemId,
      appointmentId,
      performedBy: defaultStaffId,
      performedAt: localDateToDateString(new Date()),
      controlDate: "",
      notes: "",
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await completeTreatmentSession(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof CompleteSessionFormValues, { message })
          }
        }
        return
      }
      if (result?.success) {
        toast.success(`${result.sessionNumber}. seans tamamlandı.`)
        onSuccess?.(result)
      }
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <p className="text-sm text-muted-foreground">{nextSessionNumber}. seans olarak kaydedilecek.</p>
        <FormField
          control={form.control}
          name="performedBy"
          label="İşlemi Yapan Personel"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FormField
          control={form.control}
          name="performedAt"
          label="Seans Tarihi"
          render={({ field }) => (
            <DatePicker
              value={dateStringToLocalDate(field.value)}
              onChange={(date) => field.onChange(localDateToDateString(date))}
            />
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
              name="notes"
              label="Not"
              render={({ field }) => (
                <Textarea {...field} rows={3} placeholder="Bu seans hakkında kısa bir not..." />
              )}
            />
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" variant="success" loading={isPending} className="w-full sm:w-fit">
        Seansı Tamamla
      </Button>
    </form>
  )
}

export { CompleteSessionForm }

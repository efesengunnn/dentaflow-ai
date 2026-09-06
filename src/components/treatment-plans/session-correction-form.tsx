"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
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
import { correctTreatmentSession, type SessionActionState } from "@/lib/treatment-plans/actions"
import { correctSessionFormSchema, type CorrectSessionFormValues } from "@/lib/treatment-plans/schema"
import type { AssignableStaff } from "@/lib/staff/queries"
import type { TreatmentSessionRow } from "@/lib/treatment-plans/queries"

type SessionCorrectionFormProps = {
  session: TreatmentSessionRow
  staffOptions: AssignableStaff[]
  onSuccess?: (state: Extract<SessionActionState, { success: true }>) => void
}

/**
 * "Seansı Düzelt" — the original session is never edited; this inserts a
 * fresh replacement session and marks the original `corrected`, mirroring
 * the append-only payment-correction pattern. `reason` is mandatory —
 * matches the `treatment_sessions_state_machine_consistent` DB constraint.
 */
function SessionCorrectionForm({ session, staffOptions, onSuccess }: SessionCorrectionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<CorrectSessionFormValues>({
    resolver: zodResolver(correctSessionFormSchema),
    defaultValues: {
      sessionId: session.id,
      reason: "",
      performedBy: session.performedById,
      performedAt: session.performedAt,
      controlDate: session.controlDate ?? "",
      notes: session.notes ?? "",
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await correctTreatmentSession(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof CorrectSessionFormValues, { message })
          }
        }
        return
      }
      if (result?.success) {
        toast.success(`${result.sessionNumber}. seans düzeltildi.`)
        onSuccess?.(result)
      }
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <FormField
          control={form.control}
          name="reason"
          label="Düzeltme Sebebi"
          render={({ field }) => (
            <Textarea {...field} rows={3} placeholder="Bu seans kaydı neden düzeltiliyor?" />
          )}
        />
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
        <FormField
          control={form.control}
          name="controlDate"
          label="Kontrol Tarihi (opsiyonel)"
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
          label="Not (opsiyonel)"
          render={({ field }) => <Textarea {...field} rows={3} placeholder="Bu seans hakkında kısa bir not..." />}
        />
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        Düzeltmeyi Kaydet
      </Button>
    </form>
  )
}

export { SessionCorrectionForm }

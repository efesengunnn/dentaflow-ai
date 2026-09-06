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
import { MoneyInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import { recordTreatmentPlanPayment, type RecordTreatmentPlanPaymentActionState } from "@/lib/treatment-plans/actions"
import { TREATMENT_PAYMENT_METHOD_OPTIONS } from "@/lib/treatment-plans/constants"
import { treatmentPlanPaymentFormSchema, type TreatmentPlanPaymentFormValues } from "@/lib/treatment-plans/schema"

type TreatmentPlanPaymentFormProps = {
  treatmentPlanId: string
  remainingBalance: number | null
  onSuccess?: (state: Extract<RecordTreatmentPlanPaymentActionState, { success: true }>) => void
}

/** "Ödeme Ekle" — always `entry_type = 'payment'`; append-only, never edits a prior payment. Sprint 28D equivalent of `PaymentForm`, pointed at `treatment_plan_id`. */
function TreatmentPlanPaymentForm({ treatmentPlanId, remainingBalance, onSuccess }: TreatmentPlanPaymentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<TreatmentPlanPaymentFormValues>({
    resolver: zodResolver(treatmentPlanPaymentFormSchema),
    defaultValues: {
      treatmentPlanId,
      amount: remainingBalance !== null && remainingBalance > 0 ? remainingBalance : 0,
      method: "cash",
      paidAt: localDateToDateString(new Date()),
      note: "",
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await recordTreatmentPlanPayment(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof TreatmentPlanPaymentFormValues, { message })
          }
        }
        return
      }
      toast.success("Ödeme kaydedildi.")
      if (result?.success) onSuccess?.(result)
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <FormField
          control={form.control}
          name="amount"
          label="Tutar"
          render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
        />
        <FormField
          control={form.control}
          name="method"
          label="Ödeme Yöntemi"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_PAYMENT_METHOD_OPTIONS.map((option) => (
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
          name="paidAt"
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
          render={({ field }) => <Textarea {...field} rows={3} placeholder="Bu ödeme hakkında kısa bir not..." />}
        />
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        Ödemeyi Kaydet
      </Button>
    </form>
  )
}

export { TreatmentPlanPaymentForm }

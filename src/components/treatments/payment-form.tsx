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
import { recordPayment, type TreatmentActionState } from "@/lib/treatments/actions"
import { TREATMENT_PAYMENT_METHOD_OPTIONS } from "@/lib/treatments/constants"
import {
  treatmentPaymentFormDefaults,
  treatmentPaymentFormSchema,
  type TreatmentPaymentFormValues,
} from "@/lib/treatments/schema"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"

type PaymentFormProps = {
  seriesId: string
  remainingBalance: number | null
  onSuccess?: (state: Extract<TreatmentActionState, { success: true }>) => void
}

/** "Ödeme Ekle" — always `entry_type = 'payment'`; append-only, never edits a prior payment. */
function PaymentForm({ seriesId, remainingBalance, onSuccess }: PaymentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<TreatmentPaymentFormValues>({
    resolver: zodResolver(treatmentPaymentFormSchema),
    defaultValues: {
      ...treatmentPaymentFormDefaults,
      seriesId,
      amount: remainingBalance !== null && remainingBalance > 0 ? remainingBalance : 0,
      // Sprint 12: almost every payment is recorded the day it happens —
      // pre-filling today removes a click for the common case, same
      // reasoning as `amount` already defaulting to the remaining balance.
      paidAt: localDateToDateString(new Date()),
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await recordPayment(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof TreatmentPaymentFormValues, { message })
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
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Kalan Bakiye</span>
          <span className="text-base font-semibold">
            {remainingBalance === null ? "Belirlenmedi" : `${remainingBalance.toLocaleString("tr-TR")} ₺`}
          </span>
        </div>
        <FormField
          control={form.control}
          name="amount"
          label="Tutar"
          render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            label="Ödeme Tarihi"
            render={({ field }) => (
              <DatePicker
                value={dateStringToLocalDate(field.value)}
                onChange={(date) => field.onChange(localDateToDateString(date))}
              />
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="note"
          label="Not (opsiyonel)"
          render={({ field }) => <Textarea {...field} rows={3} placeholder="Bu ödeme hakkında kısa bir not..." />}
        />
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        Ödeme Ekle
      </Button>
    </form>
  )
}

export { PaymentForm }

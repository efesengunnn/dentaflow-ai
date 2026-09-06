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
import { recordPaymentCorrection, type TreatmentActionState } from "@/lib/treatments/actions"
import {
  TREATMENT_PAYMENT_ENTRY_TYPE_OPTIONS,
  TREATMENT_PAYMENT_METHOD_OPTIONS,
} from "@/lib/treatments/constants"
import {
  treatmentPaymentCorrectionSchema,
  type TreatmentPaymentCorrectionValues,
} from "@/lib/treatments/schema"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import type { TreatmentPaymentRow } from "@/lib/treatments/queries"

type PaymentCorrectionFormProps = {
  seriesId: string
  payment: TreatmentPaymentRow
  onSuccess?: (state: Extract<TreatmentActionState, { success: true }>) => void
}

/** "İade / Düzeltme" — always references the payment it corrects (`related_payment_id`), never edits the original row. */
function PaymentCorrectionForm({ seriesId, payment, onSuccess }: PaymentCorrectionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<TreatmentPaymentCorrectionValues>({
    resolver: zodResolver(treatmentPaymentCorrectionSchema),
    defaultValues: {
      seriesId,
      relatedPaymentId: payment.id,
      entryType: "refund",
      amount: payment.amount,
      method: payment.method,
      paidAt: "",
      note: "",
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await recordPaymentCorrection(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof TreatmentPaymentCorrectionValues, { message })
          }
        }
        return
      }
      toast.success("Ödeme düzeltildi.")
      if (result?.success) onSuccess?.(result)
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <p className="text-sm text-muted-foreground">
          Düzeltilecek ödeme: {payment.amount.toLocaleString("tr-TR")} ₺ ·{" "}
          {new Date(payment.paidAt).toLocaleDateString("tr-TR")}
        </p>
        <FormField
          control={form.control}
          name="entryType"
          label="Düzeltme Türü"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_PAYMENT_ENTRY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>
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
          render={({ field }) => <Textarea {...field} rows={3} placeholder="Bu düzeltme hakkında kısa bir not..." />}
        />
      </FieldGroup>

      <FormError message={formError} />

      <Button type="submit" loading={isPending} className="w-full sm:w-fit">
        Kaydet
      </Button>
    </form>
  )
}

export { PaymentCorrectionForm }

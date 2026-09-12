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
import { CURRENCY_OPTIONS, type CurrencyCode } from "@/lib/format/currency"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import { recordTreatmentPlanPayment, type RecordTreatmentPlanPaymentActionState } from "@/lib/treatment-plans/actions"
import { TREATMENT_PAYMENT_METHOD_OPTIONS } from "@/lib/treatment-plans/constants"
import { treatmentPlanPaymentFormSchema, type TreatmentPlanPaymentFormValues } from "@/lib/treatment-plans/schema"

/** Per-currency outstanding balance for the plan — drives the currency picker and the default amount. */
export type CurrencyBalance = { currency: string; remaining: number | null }

type TreatmentPlanPaymentFormProps = {
  treatmentPlanId: string
  /** One entry per currency the plan involves; a mixed plan has more than one. */
  currencyBalances: CurrencyBalance[]
  onSuccess?: (state: Extract<RecordTreatmentPlanPaymentActionState, { success: true }>) => void
}

function defaultAmountFor(remaining: number | null): number {
  return remaining !== null && remaining > 0 ? remaining : 0
}

/** "Ödeme Ekle" — always `entry_type = 'payment'`; append-only, never edits a prior payment. Sprint 28D equivalent of `PaymentForm`, pointed at `treatment_plan_id`. Sprint 31 — currency-aware: a mixed plan lets the payer pick which currency's balance this pays down. */
function TreatmentPlanPaymentForm({ treatmentPlanId, currencyBalances, onSuccess }: TreatmentPlanPaymentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const balances = currencyBalances.length > 0 ? currencyBalances : [{ currency: "TRY", remaining: null }]
  // Default to the first currency that still owes something, else the first.
  const initialBalance = balances.find((b) => b.remaining !== null && b.remaining > 0) ?? balances[0]
  const multiCurrency = balances.length > 1

  const form = useForm<TreatmentPlanPaymentFormValues>({
    resolver: zodResolver(treatmentPlanPaymentFormSchema),
    defaultValues: {
      treatmentPlanId,
      amount: defaultAmountFor(initialBalance.remaining),
      currency: (initialBalance.currency as CurrencyCode) ?? "TRY",
      method: "cash",
      paidAt: localDateToDateString(new Date()),
      note: "",
    },
  })

  function handleCurrencyChange(currency: CurrencyCode) {
    form.setValue("currency", currency)
    // Re-default the amount to the newly-selected currency's own outstanding
    // balance, so switching currency never leaves a stale amount from the other.
    const match = balances.find((b) => b.currency === currency)
    form.setValue("amount", defaultAmountFor(match?.remaining ?? null))
  }

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
          name="currency"
          label="Para Birimi"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(value) => handleCurrencyChange(value as CurrencyCode)} disabled={!multiCurrency}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((option) => (
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

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { addPatientPayment } from "@/lib/payments/actions"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import { patientPaymentFormDefaults, patientPaymentFormSchema, type PatientPaymentFormValues } from "@/lib/teeth/schema"

function AddPaymentSheet({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<PatientPaymentFormValues>({
    resolver: zodResolver(patientPaymentFormSchema),
    defaultValues: { ...patientPaymentFormDefaults, paidAt: localDateToDateString(new Date()) },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await addPatientPayment(patientId, values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof PatientPaymentFormValues, { message })
          }
        }
        return
      }
      toast.success("Ödeme kaydedildi.")
      setOpen(false)
      form.reset({ ...patientPaymentFormDefaults, paidAt: localDateToDateString(new Date()) })
      router.refresh()
    })
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          Ödeme Ekle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ödeme Ekle</SheetTitle>
          <SheetDescription>Bu hasta için yapılan bir tahsilatı kaydedin.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
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
                name="method"
                label="Yöntem (opsiyonel)"
                render={({ field }) => <Input {...field} placeholder="Örn. Nakit, Kart" />}
              />
              <FormField
                control={form.control}
                name="note"
                label="Not (opsiyonel)"
                render={({ field }) => <Textarea {...field} rows={3} placeholder="Ödeme hakkında kısa bir not..." />}
              />
            </FieldGroup>
            <div className="bg-card sticky bottom-0 flex flex-col gap-3 border-t pt-4 pb-1">
              <FormError message={formError} />
              <Button type="submit" loading={isPending} className="w-full sm:w-fit">
                Kaydet
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { AddPaymentSheet }

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { CollapsibleToggleTrigger } from "@/components/shared/collapsible-toggle-trigger"
import { ContactFormFields } from "@/components/shared/contact-form-fields"
import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Combobox } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TimeSelect } from "@/components/ui/time-select"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import { checkDuplicatePatientByPhone, type PatientActionState } from "@/lib/patients/actions"
import {
  patientFormDefaults,
  patientFormSchema,
  type PatientFormValues,
} from "@/lib/patients/schema"
import type { AssignableStaff } from "@/lib/staff/queries"

type PatientFormProps = {
  mode: "create" | "edit"
  defaultValues?: Partial<PatientFormValues>
  staffOptions: AssignableStaff[]
  onSubmit: (values: PatientFormValues) => Promise<PatientActionState>
  onSuccess?: (state: Extract<PatientActionState, { success: true }>) => void
  submitLabel?: string
  /** Hides "Aynı anda randevu oluştur" for the appointment form's inline "+ Yeni Hasta" Sheet, where creating an appointment at the same time is already the reason this form is open. */
  hideAppointmentOption?: boolean
}

function PatientForm({
  mode,
  defaultValues,
  staffOptions,
  onSubmit,
  onSuccess,
  submitLabel,
  hideAppointmentOption = false,
}: PatientFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: { ...patientFormDefaults, ...defaultValues },
  })

  const staffComboOptions = staffOptions.map((staff) => ({
    value: staff.id,
    label: staff.fullName,
  }))

  const createAppointment = form.watch("createAppointment")

  async function handlePhoneBlur(phone: string) {
    if (mode !== "create") return
    const match = await checkDuplicatePatientByPhone(phone)
    setDuplicateWarning(
      match ? `Bu telefon numarasıyla kayıtlı bir hasta var: ${match.fullName} — yine de devam edebilirsiniz.` : null,
    )
  }

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await onSubmit(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof PatientFormValues, { message })
          }
        }
        return
      }
      toast.success(mode === "create" ? "Hasta oluşturuldu." : "Hasta güncellendi.")
      if (result?.success) onSuccess?.(result)
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <ContactFormFields control={form.control} hideEmail onPhoneBlur={handlePhoneBlur} />
        {duplicateWarning && (
          <p className="text-sm text-amber-600 dark:text-amber-500">{duplicateWarning}</p>
        )}

        <Collapsible>
          <CollapsibleToggleTrigger>Diğer Bilgiler (opsiyonel)</CollapsibleToggleTrigger>
          <CollapsibleContent className="flex flex-col gap-6 pt-4">
            <FormField
              control={form.control}
              name="email"
              label="E-posta"
              render={({ field }) => (
                <Input {...field} type="email" placeholder="ayse@ornek.com" autoComplete="email" />
              )}
            />
            <FormField
              control={form.control}
              name="tcKimlikNo"
              label="TC Kimlik No"
              render={({ field }) => (
                <Input
                  {...field}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="12345678901"
                  onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 11))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="dateOfBirth"
              label="Doğum Tarihi"
              render={({ field }) => (
                <DatePicker
                  value={dateStringToLocalDate(field.value)}
                  onChange={(date) => field.onChange(localDateToDateString(date))}
                  captionLayout="dropdown"
                />
              )}
            />
            <FormField
              control={form.control}
              name="note"
              label={mode === "create" ? "Not" : "Yeni not ekle"}
              render={({ field }) => (
                <Textarea {...field} rows={3} placeholder="Bu hasta hakkında kısa bir not..." />
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        {mode === "create" && !hideAppointmentOption && (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={createAppointment}
                onCheckedChange={(checked) => form.setValue("createAppointment", checked === true)}
              />
              Aynı anda randevu oluştur
            </label>
            {createAppointment && (
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="appointmentStaffId"
                  label="Personel"
                  render={({ field }) => (
                    <Combobox
                      options={staffComboOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Personel seçin"
                    />
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="appointmentDate"
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
                    name="appointmentTime"
                    label="Saat"
                    render={({ field }) => <TimeSelect value={field.value} onChange={field.onChange} />}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </FieldGroup>

      {/* Sticky action bar — no horizontal bleed (this form renders inside
          more than one padding context: Sheets at `px-4`, the full-page
          `/patients/new` route with its own container), so it stays inset
          rather than guessing a parent's padding to escape. Still sticks to
          the bottom of whichever scroll container it's in (every Sheet
          consumer puts `overflow-y-auto` directly on `SheetContent`, so
          `sticky` resolves correctly there with no parent changes needed;
          on the full page it sticks to the viewport, an equally standard
          pattern) so the primary action stays reachable on a long form. */}
      <div className="bg-card sticky bottom-0 flex flex-col gap-3 border-t pt-4 pb-1">
        <FormError message={formError} />
        <Button type="submit" loading={isPending} className="w-full sm:w-fit">
          {submitLabel ?? (mode === "create" ? "Hasta Oluştur ve Devam Et" : "Kaydet")}
        </Button>
      </div>
    </form>
  )
}

export { PatientForm }

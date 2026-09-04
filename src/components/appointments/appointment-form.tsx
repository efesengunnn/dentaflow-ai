"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { QuickAddPatientSheet } from "@/components/appointments/quick-add-patient-sheet"
import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TimeSelect } from "@/components/ui/time-select"
import type { AppointmentActionState } from "@/lib/appointments/actions"
import { APPOINTMENT_STATUS_OPTIONS } from "@/lib/appointments/constants"
import {
  appointmentFormDefaults,
  appointmentFormSchema,
  type AppointmentFormValues,
} from "@/lib/appointments/schema"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"

type AppointmentFormProps = {
  mode: "create" | "edit"
  defaultValues?: Partial<AppointmentFormValues>
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
  onSubmit: (values: AppointmentFormValues) => Promise<AppointmentActionState>
  onSuccess?: () => void
  submitLabel?: string
}

function AppointmentForm({
  mode,
  defaultValues,
  patientOptions,
  staffOptions,
  onSubmit,
  onSuccess,
  submitLabel,
}: AppointmentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  // Sprint 14 — local copy so "+ Yeni Hasta" (below) can append the
  // just-created patient without a full page reload; the server-loaded
  // `patientOptions` prop only ever seeds the initial list.
  const [localPatientOptions, setLocalPatientOptions] = useState(patientOptions)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: { ...appointmentFormDefaults, ...defaultValues },
  })

  const patientComboOptions = localPatientOptions.map((patient) => ({
    value: patient.id,
    label: `${patient.fullName} · ${formatTurkishPhoneDisplay(patient.phone)}`,
  }))

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
            form.setError(key as keyof AppointmentFormValues, { message })
          }
        }
        return
      }
      toast.success(mode === "create" ? "Randevu oluşturuldu." : "Randevu güncellendi.")
      onSuccess?.()
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <FormField
          control={form.control}
          name="patientId"
          label="Hasta"
          render={({ field }) => (
            <Combobox
              options={patientComboOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder="Hasta seçin"
              searchPlaceholder="İsim veya telefon ara..."
              onCreateNew={() => setQuickAddOpen(true)}
              createNewLabel="Yeni Hasta Ekle"
            />
          )}
        />
        <FormField
          control={form.control}
          name="staffId"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="date"
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
            name="time"
            label="Saat"
            render={({ field }) => <TimeSelect value={field.value} onChange={field.onChange} />}
          />
        </div>
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
                {APPOINTMENT_STATUS_OPTIONS.map((option) => (
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
          name="reason"
          label="Sebep (opsiyonel)"
          render={({ field }) => <Input {...field} placeholder="Örn. Botoks konsültasyonu" />}
        />
        <FormField
          control={form.control}
          name="note"
          label={mode === "create" ? "Not (opsiyonel)" : "Yeni not ekle (opsiyonel)"}
          render={({ field }) => (
            <Textarea {...field} rows={3} placeholder="Bu randevu hakkında kısa bir not..." />
          )}
        />
      </FieldGroup>

      {/* Sticky action bar — see `PatientForm`'s identical treatment for why
          there's no horizontal-bleed margin trick here (this form also
          renders in more than one padding context: Sheets and the full-page
          `/appointments/new` route). */}
      <div className="bg-card sticky bottom-0 flex flex-col gap-3 border-t pt-4 pb-1">
        <FormError message={formError} />
        <Button type="submit" loading={isPending} className="w-full sm:w-fit">
          {submitLabel ?? (mode === "create" ? "Oluştur" : "Kaydet")}
        </Button>
      </div>

      <QuickAddPatientSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        staffOptions={staffOptions}
        onCreated={(patient) => {
          setLocalPatientOptions((options) => [patient, ...options])
          form.setValue("patientId", patient.id)
          setQuickAddOpen(false)
        }}
      />
    </form>
  )
}

export { AppointmentForm }

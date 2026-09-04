"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateClinicSettings } from "@/lib/clinic/actions"
import { clinicSettingsFormSchema, type ClinicSettingsFormValues } from "@/lib/clinic/schema"
import type { ClinicSettings } from "@/lib/clinic/queries"

function ClinicSettingsForm({ clinic }: { clinic: ClinicSettings }) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<ClinicSettingsFormValues>({
    resolver: zodResolver(clinicSettingsFormSchema),
    defaultValues: {
      name: clinic.name,
      phone: clinic.phone ?? "",
      email: clinic.email ?? "",
      address: clinic.address ?? "",
      logoUrl: clinic.logoUrl ?? "",
      businessHours: clinic.businessHours ?? "",
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await updateClinicSettings(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof ClinicSettingsFormValues, { message })
          }
        }
        return
      }
      toast.success("Klinik bilgileri güncellendi.")
    })
  })

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <FieldGroup>
        <FormField
          control={form.control}
          name="name"
          label="Klinik Adı"
          render={({ field }) => <Input {...field} placeholder="Örnek Estetik Klinik" />}
        />
        <FormField
          control={form.control}
          name="logoUrl"
          label="Logo Bağlantısı (opsiyonel)"
          description="Logonuzun barındırıldığı bir görsel bağlantısı yapıştırın."
          render={({ field }) => <Input {...field} placeholder="https://..." />}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            label="Telefon"
            render={({ field }) => (
              <Input
                {...field}
                inputMode="numeric"
                maxLength={10}
                placeholder="5xxxxxxxxx"
                onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="email"
            label="E-posta"
            render={({ field }) => <Input {...field} type="email" placeholder="info@klinik.com" />}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          label="Adres"
          render={({ field }) => <Textarea {...field} rows={2} placeholder="Klinik adresiniz" />}
        />
        <FormField
          control={form.control}
          name="businessHours"
          label="Çalışma Saatleri"
          description="Örn: Pazartesi-Cuma 09:00-18:00"
          render={({ field }) => <Input {...field} placeholder="Pazartesi-Cuma 09:00-18:00" />}
        />
      </FieldGroup>

      <div className="flex flex-col gap-3">
        <FormError message={formError} />
        <Button type="submit" loading={isPending} className="w-full sm:w-fit">
          Kaydet
        </Button>
      </div>
    </form>
  )
}

export { ClinicSettingsForm }

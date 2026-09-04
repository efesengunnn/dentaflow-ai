"use client"

import type { Control, FieldValues, Path } from "react-hook-form"

import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { capitalizeTurkishName } from "@/lib/format/name"

type ContactFieldsValues = {
  fullName: string
  phone: string
  email?: string
}

type ContactFormFieldsProps<TFieldValues extends FieldValues & ContactFieldsValues> = {
  control: Control<TFieldValues>
  /** Patient form (Sprint 8) moves E-posta under "Diğer Bilgiler" and renders it itself — leaves Lead form untouched. */
  hideEmail?: boolean
  /** Patient form's duplicate-patient check (Sprint 8) — fires on phone blur. No-op for every other caller. */
  onPhoneBlur?: (phone: string) => void
}

/**
 * Ad Soyad + Telefon (+ E-posta, unless `hideEmail`) — identical markup in
 * `LeadForm` and `PatientForm` (every module that captures a person's
 * contact details uses the same fields, same input components, same copy).
 * Extracted once Patients (Sprint 4) made the duplication concrete rather
 * than hypothetical — see the Sprint 5 duplication analysis in
 * `ARCHITECTURE.md`.
 */
function ContactFormFields<TFieldValues extends FieldValues & ContactFieldsValues>({
  control,
  hideEmail,
  onPhoneBlur,
}: ContactFormFieldsProps<TFieldValues>) {
  return (
    <>
      <FormField
        control={control}
        name={"fullName" as Path<TFieldValues>}
        label="Ad Soyad"
        render={({ field }) => (
          <Input
            {...field}
            onChange={(event) => field.onChange(capitalizeTurkishName(event.target.value))}
            placeholder="Ayşe Yılmaz"
            autoComplete="name"
          />
        )}
      />
      <FormField
        control={control}
        name={"phone" as Path<TFieldValues>}
        label="Telefon"
        render={({ field }) => (
          <PhoneInput
            value={field.value}
            onChange={field.onChange}
            onBlur={() => onPhoneBlur?.(field.value)}
          />
        )}
      />
      {hideEmail ? null : (
        <FormField
          control={control}
          name={"email" as Path<TFieldValues>}
          label="E-posta (opsiyonel)"
          render={({ field }) => (
            <Input {...field} type="email" placeholder="ayse@ornek.com" autoComplete="email" />
          )}
        />
      )}
    </>
  )
}

export { ContactFormFields }

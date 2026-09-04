"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

type FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  render: (args: {
    field: ControllerRenderProps<TFieldValues, TName>
    fieldState: ControllerFieldState
  }) => React.ReactNode
}

/**
 * Bridges React Hook Form to our own headless `Field` primitive (kept over
 * shadcn's classic Form component since Sprint 1 — see ARCHITECTURE.md) so
 * every future form gets RHF + Zod validation without giving up Field's
 * layout/error conventions.
 */
function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ control, name, label, description, render }: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}>
          {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
          {render({ field, fieldState })}
          {description && !fieldState.error && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export { FormField }

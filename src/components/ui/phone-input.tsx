"use client"

import * as React from "react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { formatTurkishPhone } from "@/lib/format/phone"

type PhoneInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "onChange" | "type"
> & {
  value?: string
  onChange?: (digits: string) => void
}

function PhoneInput({
  className,
  value = "",
  onChange,
  ...props
}: PhoneInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <span className="font-mono text-sm text-muted-foreground">0</span>
      </InputGroupAddon>
      <InputGroupInput
        data-slot="phone-input"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="5XX XXX XX XX"
        value={formatTurkishPhone(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 10)
          onChange?.(digits)
        }}
        {...props}
      />
    </InputGroup>
  )
}

export { PhoneInput }

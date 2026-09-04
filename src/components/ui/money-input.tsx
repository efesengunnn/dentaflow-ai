"use client"

import * as React from "react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function parseMoneyInput(raw: string): number | undefined {
  const normalized = raw.replace(/[^\d,]/g, "").replace(",", ".")
  if (!normalized) return undefined
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? undefined : parsed
}

function formatMoneyDisplay(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return ""
  return currencyFormatter.format(value)
}

type MoneyInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "onChange" | "type"
> & {
  value?: number
  onChange?: (value: number | undefined) => void
  currencySymbol?: string
}

/**
 * Formats on blur, not on every keystroke — reformatting live fights the
 * user's cursor position. The draft stays free-form text while focused and
 * only normalizes to "1.234,56" once the field loses focus.
 */
function MoneyInput({
  className,
  value,
  onChange,
  currencySymbol = "₺",
  ...props
}: MoneyInputProps) {
  const [draft, setDraft] = React.useState(() => formatMoneyDisplay(value))
  const [prevValue, setPrevValue] = React.useState(value)

  // Resets the draft when `value` changes from outside (e.g. form.reset()),
  // without clobbering it on every keystroke — a same-render prop→state sync
  // (see https://react.dev/learn/you-might-not-need-an-effect), not an effect.
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(formatMoneyDisplay(value))
  }

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <span className="text-sm font-medium text-muted-foreground">
          {currencySymbol}
        </span>
      </InputGroupAddon>
      <InputGroupInput
        data-slot="money-input"
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const parsed = parseMoneyInput(event.target.value)
          setDraft(formatMoneyDisplay(parsed))
          onChange?.(parsed)
        }}
        {...props}
      />
    </InputGroup>
  )
}

export { MoneyInput, parseMoneyInput, formatMoneyDisplay }

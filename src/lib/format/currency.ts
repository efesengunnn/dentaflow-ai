/**
 * Sprint 31 — multi-currency support. Most treatments are priced in TRY, a
 * few (prosthetics/veneers/crowns) in EUR. Currency lives per catalog item and
 * per treatment_plan_item, so a single plan can mix currencies; every total is
 * therefore computed and shown per currency, never summed across currencies.
 */
export const SUPPORTED_CURRENCIES = ["TRY", "EUR"] as const
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const CURRENCY_SYMBOLS: Record<string, string> = { TRY: "₺", EUR: "€" }

/** Options for a currency <Select> — symbol + code, e.g. "₺ TRY". */
export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: "TRY", label: "₺ TRY" },
  { value: "EUR", label: "€ EUR" },
]

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

/**
 * "1.000 ₺" / "600 €". `currency` defaults to TRY so the many existing
 * single-argument callers keep working unchanged (they were all implicitly
 * TRY). No fractional digits — clinic prices are whole units.
 */
export function formatCurrency(amount: number, currency: string = "TRY"): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currencySymbol(currency)}`
}

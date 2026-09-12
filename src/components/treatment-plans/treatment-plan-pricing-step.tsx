"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CURRENCY_OPTIONS, currencySymbol, type CurrencyCode } from "@/lib/format/currency"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import type { DraftTreatmentSelection } from "./treatment-plan-builder"

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol(currency)}`
}

function addDaysFromAnchor(anchor: Date, days: number): string {
  const date = new Date(anchor)
  date.setDate(date.getDate() + days)
  return localDateToDateString(date)
}

const CONTROL_DATE_QUICK_PICKS = [
  { label: "7 gün", days: 7 },
  { label: "14 gün", days: 14 },
  { label: "30 gün", days: 30 },
]

/**
 * Sprint 30.3 — Kontrol Günü her zaman hasta + kalem bazında girilir, hiçbir
 * tedavi adına sabit bir varsayılan bağlanmaz (founder kararı: "Botoks = her
 * zaman 14 gün kontrol" reddedildi). Boş bırakılabilir ama alan formdan asla
 * kaldırılmaz — AI takip sorguları için `treatment_plan_items.control_date`'e
 * yazılır.
 *
 * `anchorDate` — 7/14/30 gün hızlı seçimleri, bir ziyaret tarihi zaten
 * biliniyorsa (randevu akışının "Tek Seans / Tek İşlem" dalı) o tarihten,
 * bilinmiyorsa (paket kurucusu — henüz planlanan bir randevu yok) bugünden
 * itibaren hesaplanır. Founder feedback 2026-08-11: sisteme girilen tarihi
 * değil, hastaya verilen randevu tarihini baz almalı.
 */
function ControlDateField({
  value,
  onChange,
  anchorDate,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  anchorDate?: Date
}) {
  const anchor = anchorDate ?? new Date()
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Kontrol Günü (opsiyonel)</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {CONTROL_DATE_QUICK_PICKS.map((pick) => {
          const pickValue = addDaysFromAnchor(anchor, pick.days)
          const active = value === pickValue
          return (
            <Button
              key={pick.days}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-8"
              onClick={() => onChange(pickValue)}
            >
              {pick.label}
            </Button>
          )
        })}
        <DatePicker
          value={dateStringToLocalDate(value)}
          onChange={(date) => onChange(date ? localDateToDateString(date) : undefined)}
          placeholder="Tarih seç"
          className="h-8 w-auto"
        />
        {value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onChange(undefined)}
            aria-label="Kontrol günü kaldır"
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  )
}

/** TRY first, then the rest — deterministic, matches the ledger's order. */
function sortCurrencies(currencies: string[]): string[] {
  return [...currencies].sort((a, b) =>
    a === "TRY" ? -1 : b === "TRY" ? 1 : a.localeCompare(b),
  )
}

/**
 * Adım 4 — "Fiyat": kalem başına birim fiyat + para birimi + Kontrol Günü +
 * otomatik toplam. Sprint 31 — bir plan TRY + EUR karışık olabildiği için Ara
 * Toplam ve Genel Toplam her para birimi için ayrı gösterilir, asla toplanmaz.
 */
function TreatmentPlanPricingStep({
  selections,
  onChangeUnitPrice,
  onChangeCurrency,
  onChangeControlDate,
  committedTotalsByCurrency,
}: {
  selections: DraftTreatmentSelection[]
  onChangeUnitPrice: (key: string, price: number | undefined) => void
  onChangeCurrency: (key: string, currency: CurrencyCode) => void
  onChangeControlDate: (key: string, controlDate: string | undefined) => void
  /** Önceki turlarda eklenmiş kalemlerin para birimi bazında toplamı. */
  committedTotalsByCurrency: Record<string, number>
}) {
  const roundTotalsByCurrency = selections.reduce<Record<string, number>>((totals, row) => {
    totals[row.currency] = (totals[row.currency] ?? 0) + row.sessionCount * (row.unitPrice ?? 0)
    return totals
  }, {})

  const grandTotalsByCurrency: Record<string, number> = { ...committedTotalsByCurrency }
  for (const [currency, amount] of Object.entries(roundTotalsByCurrency)) {
    grandTotalsByCurrency[currency] = (grandTotalsByCurrency[currency] ?? 0) + amount
  }

  const roundCurrencies = sortCurrencies(Object.keys(roundTotalsByCurrency))
  const grandCurrencies = sortCurrencies(Object.keys(grandTotalsByCurrency))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Fiyat</h3>
        <p className="text-sm text-muted-foreground">Her tedavi için birim fiyat ve para birimini girin — toplam otomatik hesaplanır.</p>
      </div>

      <div className="flex flex-col gap-2">
        {selections.map((row) => {
          const total = row.sessionCount * (row.unitPrice ?? 0)
          return (
            <div key={row.key} className="flex flex-col gap-3 rounded-xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">
                  {row.treatmentName} <span className="text-muted-foreground">×{row.sessionCount}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(total, row.currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MoneyInput
                  value={row.unitPrice}
                  onChange={(value) => onChangeUnitPrice(row.key, value)}
                  placeholder="Birim fiyat (opsiyonel)"
                  className="flex-1"
                />
                <Select value={row.currency} onValueChange={(value) => onChangeCurrency(row.key, value as CurrencyCode)}>
                  <SelectTrigger className="w-24 shrink-0">
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
              </div>
              <ControlDateField value={row.controlDate} onChange={(value) => onChangeControlDate(row.key, value)} />
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl bg-muted/40 p-3.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Ara Toplam (bu sağlayıcı)</span>
          <span className="flex flex-col items-end font-medium tabular-nums">
            {roundCurrencies.length === 0
              ? formatMoney(0, "TRY")
              : roundCurrencies.map((currency) => (
                  <span key={currency}>{formatMoney(roundTotalsByCurrency[currency], currency)}</span>
                ))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Genel Toplam</span>
          <span className="flex flex-col items-end font-display text-lg font-semibold tabular-nums">
            {grandCurrencies.length === 0
              ? formatMoney(0, "TRY")
              : grandCurrencies.map((currency) => (
                  <span key={currency}>{formatMoney(grandTotalsByCurrency[currency], currency)}</span>
                ))}
          </span>
        </div>
      </div>
    </div>
  )
}

export { TreatmentPlanPricingStep, ControlDateField }

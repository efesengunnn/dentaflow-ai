"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { MoneyInput } from "@/components/ui/money-input"
import { dateStringToLocalDate, localDateToDateString } from "@/lib/format/date"
import type { DraftTreatmentSelection } from "./treatment-plan-builder"

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
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

/** Adım 4 — "Fiyat": kalem başına birim fiyat + Kontrol Günü + otomatik toplam, alt kısımda Ara Toplam (bu tur) ve Genel Toplam (düzenlenemez). */
function TreatmentPlanPricingStep({
  selections,
  onChangeUnitPrice,
  onChangeControlDate,
  committedTotal,
}: {
  selections: DraftTreatmentSelection[]
  onChangeUnitPrice: (key: string, price: number | undefined) => void
  onChangeControlDate: (key: string, controlDate: string | undefined) => void
  /** Önceki turlarda zaten eklenmiş kalemlerin toplamı — bu turun Ara Toplam'ına eklenip Genel Toplam'ı oluşturur. */
  committedTotal: number
}) {
  const roundTotal = selections.reduce((sum, row) => sum + row.sessionCount * (row.unitPrice ?? 0), 0)
  const grandTotal = committedTotal + roundTotal

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Fiyat</h3>
        <p className="text-sm text-muted-foreground">Her tedavi için birim fiyat girin — toplam otomatik hesaplanır.</p>
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
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(total)}</span>
              </div>
              <MoneyInput
                value={row.unitPrice}
                onChange={(value) => onChangeUnitPrice(row.key, value)}
                placeholder="Birim fiyat (opsiyonel)"
              />
              <ControlDateField value={row.controlDate} onChange={(value) => onChangeControlDate(row.key, value)} />
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl bg-muted/40 p-3.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Ara Toplam (bu sağlayıcı)</span>
          <span className="font-medium tabular-nums">{formatMoney(roundTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Genel Toplam</span>
          <span className="font-display text-lg font-semibold tabular-nums">{formatMoney(grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}

export { TreatmentPlanPricingStep, ControlDateField }

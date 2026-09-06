"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { TreatmentPlanItemInput } from "@/lib/treatment-plans/schema"

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

/**
 * Adım 6 — "Özet": sağlayıcıya göre gruplu kalem listesi + sağlayıcı alt
 * toplamı, Genel Toplam, plan adı (opsiyonel). Sprint 30 — `isOwner` true
 * iken ayrıca sağlayıcı bazlı ciro dağılımı gösterilir (aynı "owner-only,
 * sağlayıcının kendisi bile göremez" kuralı `provider_share_amount`'ın zaten
 * kullandığı, bkz. treatment_plan_items şeması); sekreter bu bölümü hiç
 * görmez.
 */
function TreatmentPlanSummaryStep({
  items,
  providerNameById,
  planName,
  onPlanNameChange,
  isOwner,
}: {
  items: TreatmentPlanItemInput[]
  providerNameById: Record<string, string>
  planName: string
  onPlanNameChange: (value: string) => void
  isOwner: boolean
}) {
  const itemsByProvider = new Map<string, TreatmentPlanItemInput[]>()
  for (const item of items) {
    const list = itemsByProvider.get(item.providerId) ?? []
    list.push(item)
    itemsByProvider.set(item.providerId, list)
  }
  const providerTotals = Array.from(itemsByProvider.entries()).map(([providerId, providerItems]) => ({
    providerId,
    total: providerItems.reduce((sum, item) => sum + item.sessionCount * (item.unitPrice ?? 0), 0),
  }))
  const grandTotal = items.reduce((sum, item) => sum + item.sessionCount * (item.unitPrice ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Özet ve Kaydet</h3>
        <p className="text-sm text-muted-foreground">Planı oluşturmadan önce son bir kez kontrol edin.</p>
      </div>

      <div className="flex flex-col gap-4">
        {Array.from(itemsByProvider.entries()).map(([providerId, providerItems]) => {
          const subtotal = providerItems.reduce((sum, item) => sum + item.sessionCount * (item.unitPrice ?? 0), 0)
          return (
            <div key={providerId} className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold">{providerNameById[providerId] ?? "Sağlayıcı"}</p>
              <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
                {providerItems.map((item, index) => (
                  <div
                    key={`${item.treatmentName}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {item.treatmentName} <span className="text-muted-foreground">×{item.sessionCount}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatMoney(item.sessionCount * (item.unitPrice ?? 0))}
                    </span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm">
                  <span className="text-muted-foreground">Alt Toplam</span>
                  <span className="font-medium tabular-nums">{formatMoney(subtotal)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3.5">
        <span className="font-medium">Genel Toplam</span>
        <span className="font-display text-lg font-semibold tabular-nums">{formatMoney(grandTotal)}</span>
      </div>

      {isOwner && providerTotals.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border p-3.5">
          <p className="text-xs font-medium text-muted-foreground">Sağlayıcı Bazlı Ciro Dağılımı</p>
          {providerTotals.map(({ providerId, total }) => (
            <div key={providerId} className="flex items-center justify-between text-sm">
              <span>{providerNameById[providerId] ?? "Sağlayıcı"}</span>
              <span className="font-medium tabular-nums">{formatMoney(total)}</span>
            </div>
          ))}
        </div>
      )}

      <Field>
        <FieldLabel htmlFor="treatment-plan-name">Plan Adı (opsiyonel)</FieldLabel>
        <Input
          id="treatment-plan-name"
          value={planName}
          onChange={(event) => onPlanNameChange(event.target.value)}
          placeholder="Örn. Botoks + PRP Planı"
        />
      </Field>
    </div>
  )
}

export { TreatmentPlanSummaryStep }

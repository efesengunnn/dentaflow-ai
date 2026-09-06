"use client"

import type { TreatmentPlanItemInput } from "@/lib/treatment-plans/schema"

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

/**
 * "OLUŞTURULAN PAKET" — kalıcı özet bloğu (Sprint 30.3, madde B). Kullanıcı
 * "Yeni Sağlayıcı Ekle" dediğinde önceki turlarda eklenen kalemler kaybolmuş
 * hissi vermesin diye, sadece yeni-sağlayıcı giriş paneli (adım 1-4)
 * temizlenirken bu blok `committedItems` üstünde sabit kalır. Aynı
 * sağlayıcıya-göre-grupla + Alt Toplam deseni `TreatmentPlanSummaryStep`
 * (adım 6) ile aynı — burası sadece daha kompakt, düzenlenemez bir önizleme.
 */
function TreatmentPlanCommittedSummary({
  items,
  providerNameById,
}: {
  items: TreatmentPlanItemInput[]
  providerNameById: Record<string, string>
}) {
  if (items.length === 0) return null

  const itemsByProvider = new Map<string, TreatmentPlanItemInput[]>()
  for (const item of items) {
    const list = itemsByProvider.get(item.providerId) ?? []
    list.push(item)
    itemsByProvider.set(item.providerId, list)
  }
  const grandTotal = items.reduce((sum, item) => sum + item.sessionCount * (item.unitPrice ?? 0), 0)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3.5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Oluşturulan Paket</p>
      <div className="flex flex-col gap-3">
        {Array.from(itemsByProvider.entries()).map(([providerId, providerItems]) => {
          const subtotal = providerItems.reduce((sum, item) => sum + item.sessionCount * (item.unitPrice ?? 0), 0)
          return (
            <div key={providerId} className="flex flex-col gap-1">
              <p className="text-sm font-semibold">{providerNameById[providerId] ?? "Sağlayıcı"}</p>
              {providerItems.map((item, index) => (
                <div key={`${item.treatmentName}-${index}`} className="flex items-center justify-between gap-3 pl-3 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.treatmentName} <span>×{item.sessionCount}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(item.sessionCount * (item.unitPrice ?? 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pl-3 text-sm">
                <span className="text-muted-foreground">Ara Toplam</span>
                <span className="font-medium tabular-nums">{formatMoney(subtotal)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between border-t border-primary/20 pt-2">
        <span className="text-sm font-semibold">Genel Toplam</span>
        <span className="font-display text-base font-semibold tabular-nums">{formatMoney(grandTotal)}</span>
      </div>
    </div>
  )
}

export { TreatmentPlanCommittedSummary }

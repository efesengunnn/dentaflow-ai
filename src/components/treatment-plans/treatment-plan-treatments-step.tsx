"use client"

import { Plus, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchInput } from "@/components/ui/search-input"
import { formatCurrency } from "@/lib/format/currency"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { DraftTreatmentSelection } from "./treatment-plan-builder"

/**
 * Adım 2 — "Tedavileri Seç": arama, checkbox, ve "Özel tedavi ekle". Sprint
 * 30 — gerçek `staff_treatment_catalog_items` verisini kullanır (Sprint
 * 28C'deki geçici `MOCK_CATALOG` kararı geri alındı, founder talimatı):
 * `catalog` artık seçili sağlayıcıya özel, gerçek bir liste. Hiçbir
 * varsayılan seans sayısı önerilmez — seçilince her zaman 1 seansla başlar,
 * Adım 3'te elle değiştirilir (founder kararı).
 */
function TreatmentPlanTreatmentsStep({
  providerName,
  catalog,
  selections,
  onToggleCatalogItem,
  onAddCustom,
  onRemoveCustom,
}: {
  providerName: string
  catalog: CatalogItem[]
  selections: DraftTreatmentSelection[]
  onToggleCatalogItem: (treatmentName: string, currency: string) => void
  onAddCustom: (name: string) => void
  onRemoveCustom: (key: string) => void
}) {
  const [search, setSearch] = useState("")
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState("")

  const selectedNames = useMemo(
    () => new Set(selections.filter((row) => !row.isCustom).map((row) => row.treatmentName)),
    [selections],
  )
  const customSelections = selections.filter((row) => row.isCustom)

  const filteredCatalog = catalog.filter((item) =>
    item.treatmentType.toLocaleLowerCase("tr").includes(search.trim().toLocaleLowerCase("tr")),
  )

  function handleCustomConfirm() {
    const trimmed = customName.trim()
    if (!trimmed) return
    onAddCustom(trimmed)
    setCustomOpen(false)
    setCustomName("")
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Tedavileri Seç</h3>
        <p className="text-sm text-muted-foreground">{providerName} bu planda hangi işlemleri uygulayacak?</p>
      </div>

      <SearchInput
        placeholder="Tedavi ara..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch("")}
      />

      <div className="flex flex-col gap-1">
        {catalog.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {providerName} için Ayarlar&apos;da tanımlı bir tedavi kataloğu yok. Aşağıdan &quot;Özel tedavi ekle&quot;
            ile devam edebilirsiniz.
          </p>
        ) : filteredCatalog.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Eşleşen tedavi bulunamadı.</p>
        ) : (
          filteredCatalog.map((item) => {
            const checked = selectedNames.has(item.treatmentType)
            return (
              <Label
                key={item.id}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-muted/40 has-[[data-checked]]:bg-primary/5"
              >
                <span className="flex items-center gap-3">
                  <Checkbox checked={checked} onCheckedChange={() => onToggleCatalogItem(item.treatmentType, item.currency)} />
                  <span className="font-medium">{item.treatmentType}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {item.defaultPrice !== null ? formatCurrency(item.defaultPrice, item.currency) : item.currency}
                </span>
              </Label>
            )
          })
        )}
      </div>

      {customSelections.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Özel Tedaviler</p>
          {customSelections.map((row) => (
            <div key={row.key} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2.5 py-2">
              <span className="font-medium">{row.treatmentName}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Özel tedaviyi kaldır"
                onClick={() => onRemoveCustom(row.key)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!customOpen ? (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary transition-opacity duration-150 hover:opacity-80"
        >
          <Plus className="size-4" />
          Özel tedavi ekle
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3.5">
          <Input
            autoFocus
            placeholder="Tedavi adı"
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleCustomConfirm()
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" onClick={handleCustomConfirm} disabled={!customName.trim()}>
              Ekle
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { TreatmentPlanTreatmentsStep }

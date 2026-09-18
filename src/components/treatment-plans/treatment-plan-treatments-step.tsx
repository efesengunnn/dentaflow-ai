"use client"

import { Plus, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Odontogram } from "@/components/shared/odontogram"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchInput } from "@/components/ui/search-input"
import { formatCurrency } from "@/lib/format/currency"
import { formatToothList } from "@/lib/odontogram/fdi"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { DraftTreatmentSelection } from "./treatment-plan-builder"

/**
 * Adım 2 — "Tedavileri Seç": arama, checkbox, ve "Özel tedavi ekle". Sprint
 * 30 — gerçek `staff_treatment_catalog_items` verisini kullanır (Sprint
 * 28C'deki geçici `MOCK_CATALOG` kararı geri alındı, founder talimatı):
 * `catalog` artık seçili sağlayıcıya özel, gerçek bir liste. Hiçbir
 * varsayılan seans sayısı önerilmez — seçilince her zaman 1 seansla başlar,
 * Adım 3'te elle değiştirilir (founder kararı).
 *
 * Sprint 33 — seçilen her tedavinin altında, tıklanınca açılan bir "Diş
 * Şeması" (Odontogram) accordion'u yer alır (founder kararı: diş eşleştirme
 * tam da tedavinin seçildiği ekranda, ayrı bir adım olmadan yapılır). Diş
 * seçimi opsiyoneldir — tüm ağzı ilgilendiren tedavilerde boş bırakılır.
 */
function ToothChartAccordion({
  selection,
  patientBirthDate,
  onChangeToothNumbers,
}: {
  selection: DraftTreatmentSelection
  patientBirthDate?: string | null
  onChangeToothNumbers: (key: string, toothNumbers: number[]) => void
}) {
  return (
    <Accordion type="single" collapsible className="border-border bg-muted/30 rounded-xl border">
      <AccordionItem value="teeth" className="border-b-0">
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Diş Şeması</span>
            {selection.toothNumbers.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {formatToothList(selection.toothNumbers)}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-xs">Tüm ağız</span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3">
          <Odontogram
            value={selection.toothNumbers}
            onChange={(numbers) => onChangeToothNumbers(selection.key, numbers)}
            birthDate={patientBirthDate}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function TreatmentPlanTreatmentsStep({
  providerName,
  patientBirthDate,
  catalog,
  selections,
  onToggleCatalogItem,
  onAddCustom,
  onRemoveCustom,
  onChangeToothNumbers,
}: {
  providerName: string
  patientBirthDate?: string | null
  catalog: CatalogItem[]
  selections: DraftTreatmentSelection[]
  onToggleCatalogItem: (treatmentName: string, currency: string, defaultPrice: number | null) => void
  onAddCustom: (name: string) => void
  onRemoveCustom: (key: string) => void
  onChangeToothNumbers: (key: string, toothNumbers: number[]) => void
}) {
  const [search, setSearch] = useState("")
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState("")

  const selectionByName = useMemo(
    () => new Map(selections.filter((row) => !row.isCustom).map((row) => [row.treatmentName, row])),
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
        <p className="text-muted-foreground text-sm">
          {providerName} bu planda hangi işlemleri uygulayacak? Seçtiğiniz tedavinin altından diş şemasını açıp
          uygulanacak dişleri işaretleyebilirsiniz.
        </p>
      </div>

      <SearchInput
        placeholder="Tedavi ara..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch("")}
      />

      <div className="flex flex-col gap-2">
        {catalog.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            {providerName} için Ayarlar&apos;da tanımlı bir tedavi kataloğu yok. Aşağıdan &quot;Özel tedavi ekle&quot;
            ile devam edebilirsiniz.
          </p>
        ) : filteredCatalog.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">Eşleşen tedavi bulunamadı.</p>
        ) : (
          filteredCatalog.map((item) => {
            const selection = selectionByName.get(item.treatmentType)
            return (
              <div key={item.id} className="flex flex-col gap-1.5">
                {/* Sprint 36 — each treatment is now a card-like row (border +
                    resting shadow, lift on hover). Selected state is unmistakable:
                    a solid primary left-accent bar (via a transparent→primary left
                    border, so checking causes no layout shift), a primary-tinted
                    fill and a primary ring. */}
                <Label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border border-l-4 border-l-transparent bg-card px-3 py-2.5 shadow-xs transition-all duration-150 hover:bg-muted/30 hover:shadow-sm has-[[data-checked]]:border-l-primary has-[[data-checked]]:bg-primary/5 has-[[data-checked]]:ring-1 has-[[data-checked]]:ring-primary/30">
                  <span className="flex items-center gap-3">
                    <Checkbox
                      checked={selection !== undefined}
                      onCheckedChange={() => onToggleCatalogItem(item.treatmentType, item.currency, item.defaultPrice)}
                    />
                    <span className="font-medium">{item.treatmentType}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {item.defaultPrice !== null ? formatCurrency(item.defaultPrice, item.currency) : item.currency}
                  </span>
                </Label>
                {selection && (
                  <div className="pl-2.5">
                    <ToothChartAccordion
                      selection={selection}
                      patientBirthDate={patientBirthDate}
                      onChangeToothNumbers={onChangeToothNumbers}
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {customSelections.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium">Özel Tedaviler</p>
          {customSelections.map((row) => (
            <div key={row.key} className="flex flex-col gap-1.5">
              {/* Sprint 36 — custom rows match the catalog rows' card treatment.
                  They're always "selected", so they carry the primary left accent
                  at rest. */}
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border border-l-4 border-l-primary bg-primary/5 px-3 py-2.5 shadow-xs ring-1 ring-primary/30">
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
              <div className="pl-2.5">
                <ToothChartAccordion
                  selection={row}
                  patientBirthDate={patientBirthDate}
                  onChangeToothNumbers={onChangeToothNumbers}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!customOpen ? (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="text-primary flex min-h-11 items-center gap-2 self-start text-sm font-medium transition-opacity duration-150 hover:opacity-80"
        >
          <Plus className="size-4" />
          Özel tedavi ekle
        </button>
      ) : (
        <div className="border-border flex flex-col gap-2 rounded-xl border p-3.5">
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

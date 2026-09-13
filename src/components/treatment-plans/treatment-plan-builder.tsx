"use client"

import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { CurrencyCode } from "@/lib/format/currency"
import { fetchCatalogForStaff } from "@/lib/treatment-catalog/actions"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { createTreatmentPlan } from "@/lib/treatment-plans/actions"
import { treatmentPlanFormSchema, type TreatmentPlanItemInput } from "@/lib/treatment-plans/schema"
import { TreatmentPlanCommittedSummary } from "./treatment-plan-committed-summary"
import { TreatmentPlanPricingStep } from "./treatment-plan-pricing-step"
import { TreatmentPlanProviderStep } from "./treatment-plan-provider-step"
import { TreatmentPlanSessionsStep } from "./treatment-plan-sessions-step"
import { TreatmentPlanStepper, type TreatmentPlanStepperStep } from "./treatment-plan-stepper"
import { TreatmentPlanSummaryStep } from "./treatment-plan-summary-step"
import { TreatmentPlanTreatmentsStep } from "./treatment-plan-treatments-step"

export type DraftTreatmentSelection = {
  key: string
  treatmentName: string
  isCustom: boolean
  sessionCount: number
  unitPrice: number | undefined
  /** Sprint 31 — carried from the catalog item, or chosen (custom) in the pricing step. */
  currency: CurrencyCode
  controlDate: string | undefined
}

const WIZARD_STEPS: TreatmentPlanStepperStep[] = [
  { number: 1, label: "Sağlayıcı Seç" },
  { number: 2, label: "Tedavileri Seç" },
  { number: 3, label: "Seans Sayısı" },
  { number: 4, label: "Fiyat" },
  { number: 5, label: "Başka Sağlayıcı" },
  { number: 6, label: "Özet ve Kaydet" },
]

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/**
 * Tedavi planı sihirbazı — Sprint 30 (Provider-Based Treatment Flow): artık
 * kendi Sheet'ini/tetikleyicisini içermiyor, "Randevu Oluştur" akışının
 * (`appointment-treatment-section.tsx`) içine gömülü render edilir — hastanın
 * kalan seansı olan bir tedavi kalemi yoksa doğrudan burada açılır, ayrı bir
 * sayfaya/Sheet'e geçilmez.
 *
 * Adım 2 artık gerçek `staff_treatment_catalog_items` verisini kullanır
 * (`fetchCatalogForStaff`) — sabit `MOCK_CATALOG` tamamen kaldırıldı (Sprint
 * 28C'deki geçici karar, founder talimatıyla geri alındı). Seans sayısı hiçbir
 * zaman varsayılan önermez, hep elle girilir (founder kararı: "Varsayılan seans
 * sayısı İSTEMİYORUM"). Birim fiyat ise katalogdaki `default_price`'tan Adım
 * 4'e otomatik gelir ve orada değiştirilebilir (founder talimatı 2026-09-13).
 */
function TreatmentPlanBuilder({
  patientId,
  staffOptions,
  isOwner,
  onCreated,
}: {
  patientId: string
  staffOptions: AssignableStaff[]
  isOwner: boolean
  onCreated: (result: { planId: string; itemIds: string[] }) => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [step, setStep] = useState(1)

  const [committedItems, setCommittedItems] = useState<TreatmentPlanItemInput[]>([])
  const [providerNameById, setProviderNameById] = useState<Record<string, string>>({})
  const [planName, setPlanName] = useState("")

  const [draftProvider, setDraftProvider] = useState<AssignableStaff | null>(null)
  const [draftTreatments, setDraftTreatments] = useState<DraftTreatmentSelection[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loadedCatalogForProviderId, setLoadedCatalogForProviderId] = useState<string | null>(null)

  // Per-currency committed totals — a plan may mix TRY + EUR items, so a
  // single cross-currency sum would be meaningless (Sprint 31).
  const committedTotalsByCurrency = committedItems.reduce<Record<string, number>>((totals, item) => {
    const currency = item.currency ?? "TRY"
    totals[currency] = (totals[currency] ?? 0) + item.sessionCount * (item.unitPrice ?? 0)
    return totals
  }, {})

  useEffect(() => {
    if (!draftProvider || loadedCatalogForProviderId === draftProvider.id) return
    let cancelled = false
    fetchCatalogForStaff(draftProvider.id).then((rows) => {
      if (cancelled) return
      setCatalog(rows)
      setLoadedCatalogForProviderId(draftProvider.id)
    })
    return () => {
      cancelled = true
    }
  }, [draftProvider, loadedCatalogForProviderId])

  function handleToggleCatalogItem(treatmentName: string, currency: string, defaultPrice: number | null) {
    setDraftTreatments((prev) => {
      const existing = prev.find((row) => !row.isCustom && row.treatmentName === treatmentName)
      if (existing) return prev.filter((row) => row !== existing)
      return [
        ...prev,
        {
          key: createId(),
          treatmentName,
          isCustom: false,
          sessionCount: 1,
          // Katalog fiyatı Adım 4'e otomatik gelir; kullanıcı orada değiştirebilir
          // (founder talimatı 2026-09-13). `null` = "Belirlenmedi" → boş bırakılır.
          unitPrice: defaultPrice ?? undefined,
          currency: (currency as CurrencyCode) ?? "TRY",
          controlDate: undefined,
        },
      ]
    })
  }

  function handleAddCustomTreatment(name: string) {
    setDraftTreatments((prev) => [
      ...prev,
      { key: createId(), treatmentName: name, isCustom: true, sessionCount: 1, unitPrice: undefined, currency: "TRY", controlDate: undefined },
    ])
  }

  function handleRemoveCustomTreatment(key: string) {
    setDraftTreatments((prev) => prev.filter((row) => row.key !== key))
  }

  function handleChangeSessionCount(key: string, count: number) {
    setDraftTreatments((prev) => prev.map((row) => (row.key === key ? { ...row, sessionCount: count } : row)))
  }

  function handleChangeUnitPrice(key: string, price: number | undefined) {
    setDraftTreatments((prev) => prev.map((row) => (row.key === key ? { ...row, unitPrice: price } : row)))
  }

  function handleChangeCurrency(key: string, currency: CurrencyCode) {
    setDraftTreatments((prev) => prev.map((row) => (row.key === key ? { ...row, currency } : row)))
  }

  function handleChangeControlDate(key: string, controlDate: string | undefined) {
    setDraftTreatments((prev) => prev.map((row) => (row.key === key ? { ...row, controlDate } : row)))
  }

  /** Mevcut turu (Adım 1-4'te toplanan sağlayıcı + tedaviler) kalıcı `committedItems`'a taşır ve taslağı sıfırlar. */
  function commitDraftRound() {
    if (!draftProvider || draftTreatments.length === 0) return
    const newItems: TreatmentPlanItemInput[] = draftTreatments.map((row) => ({
      providerId: draftProvider.id,
      treatmentName: row.treatmentName,
      sessionCount: row.sessionCount,
      unitPrice: row.unitPrice,
      currency: row.currency,
      controlDate: row.controlDate,
    }))
    setCommittedItems((prev) => [...prev, ...newItems])
    setProviderNameById((prev) => ({ ...prev, [draftProvider.id]: draftProvider.fullName }))
    setDraftProvider(null)
    setDraftTreatments([])
    setCatalog([])
    setLoadedCatalogForProviderId(null)
  }

  function handleAddAnotherProvider() {
    commitDraftRound()
    setStep(1)
  }

  function handleContinueToSummary() {
    commitDraftRound()
    setStep(6)
  }

  function canGoNext(): boolean {
    if (step === 1) return draftProvider !== null
    if (step === 2) return draftTreatments.length > 0
    if (step === 3) return draftTreatments.every((row) => row.sessionCount >= 1)
    if (step === 4) return true
    return false
  }

  async function handleSave() {
    if (isSaving) return
    const finalPlanName = planName.trim() || `${committedItems[0]?.treatmentName ?? "Yeni"} Planı`
    const parsed = treatmentPlanFormSchema.safeParse({ patientId, planName: finalPlanName, items: committedItems })
    if (!parsed.success) {
      toast.error("Plan oluşturulamadı — eksik veya hatalı alan var.")
      return
    }

    setIsSaving(true)
    const result = await createTreatmentPlan(parsed.data)
    setIsSaving(false)
    if (!result || "error" in result) {
      toast.error(result?.error ?? "Tedavi planı oluşturulamadı.")
      return
    }
    toast.success("Tedavi planı oluşturuldu.")
    onCreated({ planId: result.planId, itemIds: result.itemIds })
  }

  const currentStepLabel = WIZARD_STEPS.find((row) => row.number === step)?.label ?? ""

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-medium">Yeni Tedavi Planı</p>
        <p className="text-xs text-muted-foreground">{currentStepLabel}</p>
      </div>

      {step < 6 && <TreatmentPlanCommittedSummary items={committedItems} providerNameById={providerNameById} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <TreatmentPlanStepper steps={WIZARD_STEPS} currentStep={step} className="sm:w-36" />

        <div className="min-w-0 flex-1">
          {step === 1 && (
            <TreatmentPlanProviderStep
              providers={staffOptions}
              selectedProviderId={draftProvider?.id ?? null}
              // Founder feedback: bu tek-seçimli adımda ayrıca "İleri"ye basmak
              // gereksiz — sağlayıcı seçilir seçilmez Adım 2'ye otomatik geç.
              onSelect={(provider) => {
                setDraftProvider(provider)
                setStep(2)
              }}
            />
          )}
          {step === 2 && draftProvider && (
            <TreatmentPlanTreatmentsStep
              providerName={draftProvider.fullName}
              catalog={catalog}
              selections={draftTreatments}
              onToggleCatalogItem={handleToggleCatalogItem}
              onAddCustom={handleAddCustomTreatment}
              onRemoveCustom={handleRemoveCustomTreatment}
            />
          )}
          {step === 3 && (
            <TreatmentPlanSessionsStep selections={draftTreatments} onChangeSessionCount={handleChangeSessionCount} />
          )}
          {step === 4 && (
            <TreatmentPlanPricingStep
              selections={draftTreatments}
              onChangeUnitPrice={handleChangeUnitPrice}
              onChangeCurrency={handleChangeCurrency}
              onChangeControlDate={handleChangeControlDate}
              committedTotalsByCurrency={committedTotalsByCurrency}
            />
          )}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-medium">Başka Sağlayıcı Ekle</h3>
                <p className="text-sm text-muted-foreground">
                  Bu planda başka bir sağlayıcının uygulayacağı tedaviler var mı?
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={handleAddAnotherProvider}>
                  <Plus />
                  Sağlayıcı Ekle
                </Button>
                <Button type="button" className="min-h-11 flex-1" onClick={handleContinueToSummary}>
                  Devam Et
                </Button>
              </div>
            </div>
          )}
          {step === 6 && (
            <TreatmentPlanSummaryStep
              items={committedItems}
              providerNameById={providerNameById}
              planName={planName}
              onPlanNameChange={setPlanName}
              isOwner={isOwner}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((prev) => Math.max(1, prev - 1))}
          disabled={step === 1 || isSaving}
        >
          Geri
        </Button>
        {step === 5 ? null : step < 6 ? (
          <Button type="button" onClick={() => setStep((prev) => prev + 1)} disabled={!canGoNext()}>
            İleri
          </Button>
        ) : (
          <Button type="button" onClick={handleSave} loading={isSaving}>
            Planı Kaydet
          </Button>
        )}
      </div>
    </div>
  )
}

export { TreatmentPlanBuilder }

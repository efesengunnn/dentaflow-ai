"use client"

import { Package, Plus, Sparkles, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { UseFormSetValue } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { CollapsibleToggleTrigger } from "@/components/shared/collapsible-toggle-trigger"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { ControlDateField } from "@/components/treatment-plans/treatment-plan-pricing-step"
import { TreatmentPlanProviderStep } from "@/components/treatment-plans/treatment-plan-provider-step"
import type { AppointmentFormValues } from "@/lib/appointments/schema"
import type { AssignableStaff } from "@/lib/staff/queries"
import { fetchCatalogForStaff } from "@/lib/treatment-catalog/actions"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import { getPatientActiveTreatmentPlansForAppointment } from "@/lib/treatment-plans/actions"
import type { RemainingSessionItem } from "@/lib/treatment-plans/queries"
import { dateStringToLocalDate } from "@/lib/format/date"
import { cn } from "@/lib/utils"

type AppointmentTreatmentSectionProps = {
  setValue: UseFormSetValue<AppointmentFormValues>
  patientId: string
  staffOptions: AssignableStaff[]
  /** Founder feedback 2026-08-11: Kontrol Günü'nün 7/14/30 gün hızlı seçimleri, sisteme girilen bugünün tarihini değil, hastaya verilen bu randevunun tarihini baz almalı. Form'un "Tarih" alanı henüz seçilmemişse (boş string) bugüne düşer — ControlDateField'ın kendi varsayılanı. */
  appointmentDate?: string
}

type Mode = "choice" | "package" | "single"

/**
 * "Randevu Oluştur" akışının tedavi seçim bölümü — Sprint 30.3 (Simplified
 * Appointment Flow), tam yeniden yazım. Artık otomatik dallanma yok: kullanıcı
 * ilk ekranda iki net seçenek arasından seçer (founder kararı, madde C):
 *
 * - **Tanımlanmış Paket (C1)**: hastanın kalan seansı olan kalemlerinden
 *   birini seçer (`getPatientActiveTreatmentPlansForAppointment`), sağlayıcı
 *   otomatik atanır. Hiç kalan kalem yoksa bu seçenek devre dışı kalır — yeni
 *   paket oluşturma artık bu akışın içinde YOK (madde H: "Randevu içinde yeni
 *   paket oluşturma" kaldırıldı); kullanıcı hasta kartındaki ayrı "Paket /
 *   Tedavi Tanımla" sayfasına yönlendirilir.
 * - **Tek Seans / Tek İşlem (C2)**: paket oluşturmaz. Sağlayıcı + işlem (gerçek
 *   katalogdan ya da serbest metin) + fiyat + Kontrol Günü (opsiyonel) girilir;
 *   `treatmentPlanId`/`treatmentPlanItemId` boş kalır, bunun yerine
 *   `standaloneTreatmentName`/`standalonePrice`/`controlDate` alanlarına
 *   yazılır — AI takip sorguları için işlem adı + sağlayıcı + kontrol günü
 *   hep kaydedilir.
 */
function AppointmentTreatmentSection({ setValue, patientId, staffOptions, appointmentDate }: AppointmentTreatmentSectionProps) {
  const controlDateAnchor = appointmentDate ? dateStringToLocalDate(appointmentDate) : undefined
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState<Mode>("choice")

  // C1 — Tanımlanmış Paket
  const [remainingItems, setRemainingItems] = useState<RemainingSessionItem[]>([])
  const [loadedForPatientId, setLoadedForPatientId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // C2 — Tek Seans / Tek İşlem
  const [singleProvider, setSingleProvider] = useState<AssignableStaff | null>(null)
  const [singleCatalog, setSingleCatalog] = useState<CatalogItem[]>([])
  const [loadedCatalogForProviderId, setLoadedCatalogForProviderId] = useState<string | null>(null)
  const [singleTreatmentName, setSingleTreatmentName] = useState<string | null>(null)
  const [singleCustomOpen, setSingleCustomOpen] = useState(false)
  const [singleCustomName, setSingleCustomName] = useState("")
  const [singlePrice, setSinglePrice] = useState<number | undefined>(undefined)
  const [singleControlDate, setSingleControlDate] = useState<string | undefined>(undefined)

  const loading = open && mode === "package" && Boolean(patientId) && loadedForPatientId !== patientId

  function clearAllSelection() {
    setSelectedItemId(null)
    setValue("treatmentPlanId", "")
    setValue("treatmentPlanItemId", "")
    setValue("staffId", "")
    setValue("standaloneTreatmentName", "")
    setValue("standalonePrice", undefined)
    setValue("controlDate", "")
  }

  function selectItem(item: RemainingSessionItem) {
    setSelectedItemId(item.itemId)
    setValue("treatmentPlanId", item.treatmentPlanId)
    setValue("treatmentPlanItemId", item.itemId)
    setValue("staffId", item.providerId)
  }

  function loadRemainingItems(nextPatientId: string) {
    let cancelled = false
    getPatientActiveTreatmentPlansForAppointment(nextPatientId).then((rows) => {
      if (cancelled) return
      setRemainingItems(rows)
      setLoadedForPatientId(nextPatientId)
      if (rows.length === 1) selectItem(rows[0])
    })
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    if (!open || !patientId || loadedForPatientId === patientId) return
    return loadRemainingItems(patientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, loadedForPatientId])

  useEffect(() => {
    if (!singleProvider || loadedCatalogForProviderId === singleProvider.id) return
    let cancelled = false
    fetchCatalogForStaff(singleProvider.id).then((rows) => {
      if (cancelled) return
      setSingleCatalog(rows)
      setLoadedCatalogForProviderId(singleProvider.id)
    })
    return () => {
      cancelled = true
    }
  }, [singleProvider, loadedCatalogForProviderId])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetToChoice()
  }

  function resetToChoice() {
    setMode("choice")
    clearAllSelection()
    setSingleProvider(null)
    setSingleCatalog([])
    setLoadedCatalogForProviderId(null)
    setSingleTreatmentName(null)
    setSingleCustomOpen(false)
    setSingleCustomName("")
    setSinglePrice(undefined)
    setSingleControlDate(undefined)
  }

  function chooseMode(next: Mode) {
    clearAllSelection()
    setMode(next)
  }

  function selectSingleProvider(provider: AssignableStaff) {
    setSingleProvider(provider)
    setSingleTreatmentName(null)
    setValue("staffId", provider.id)
  }

  function selectSingleTreatment(name: string) {
    setSingleTreatmentName(name)
    setValue("standaloneTreatmentName", name)
  }

  function confirmSingleCustomTreatment() {
    const trimmed = singleCustomName.trim()
    if (!trimmed) return
    selectSingleTreatment(trimmed)
    setSingleCustomOpen(false)
  }

  function changeSinglePrice(value: number | undefined) {
    setSinglePrice(value)
    setValue("standalonePrice", value)
  }

  function changeSingleControlDate(value: string | undefined) {
    setSingleControlDate(value)
    setValue("controlDate", value ?? "")
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleToggleTrigger>+ Tedavi Tanımla (opsiyonel)</CollapsibleToggleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 pt-4">
        {!patientId ? (
          <p className="text-sm text-muted-foreground">Önce hasta seçin.</p>
        ) : mode === "choice" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={loading || remainingItems.length === 0}
              onClick={() => chooseMode("package")}
              className={cn(
                "flex min-h-24 flex-1 flex-col items-start gap-1.5 rounded-xl border border-border p-4 text-left transition-colors duration-150",
                loading || remainingItems.length === 0
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-primary hover:bg-primary/5",
              )}
            >
              <Package className="size-5 text-primary" />
              <span className="font-medium">Tanımlanmış Paket</span>
              <span className="text-xs text-muted-foreground">
                {loading
                  ? "Yükleniyor..."
                  : remainingItems.length === 0
                    ? "Bu hastanın kalan seansı olan bir paketi yok."
                    : "Hastanın kalan seanslarından birini seçin."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => chooseMode("single")}
              className="flex min-h-24 flex-1 flex-col items-start gap-1.5 rounded-xl border border-border p-4 text-left transition-colors duration-150 hover:border-primary hover:bg-primary/5"
            >
              <Sparkles className="size-5 text-primary" />
              <span className="font-medium">Tek Seans / Tek İşlem</span>
              <span className="text-xs text-muted-foreground">Pakete bağlı olmayan tek bir işlem için randevu.</span>
            </button>
          </div>
        ) : mode === "package" ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={resetToChoice}
              className="self-start text-sm font-medium text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
            >
              ← Geri
            </button>
            {remainingItems.map((item) => {
              const checked = item.itemId === selectedItemId
              return (
                <button
                  key={item.itemId}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors duration-150 hover:bg-muted/40",
                    checked ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <span className="font-medium">
                    {item.treatmentName} <span className="font-normal text-muted-foreground">— {item.providerName}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.remainingSessions}/{item.sessionCount} kaldı
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={resetToChoice}
              className="self-start text-sm font-medium text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
            >
              ← Geri
            </button>

            <TreatmentPlanProviderStep
              providers={staffOptions}
              selectedProviderId={singleProvider?.id ?? null}
              onSelect={selectSingleProvider}
            />

            {singleProvider && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-sm font-medium">İşlem</p>
                {singleCatalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {singleProvider.fullName} için tanımlı bir katalog yok. Aşağıdan işlem adını yazabilirsiniz.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {singleCatalog.map((item) => {
                      const checked = singleTreatmentName === item.treatmentType
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectSingleTreatment(item.treatmentType)}
                          className={cn(
                            "flex min-h-11 items-center rounded-lg border p-3 text-left text-sm font-medium transition-colors duration-150 hover:bg-muted/40",
                            checked ? "border-primary bg-primary/5" : "border-border",
                          )}
                        >
                          {item.treatmentType}
                        </button>
                      )
                    })}
                  </div>
                )}

                {!singleCustomOpen ? (
                  <button
                    type="button"
                    onClick={() => setSingleCustomOpen(true)}
                    className="flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary transition-opacity duration-150 hover:opacity-80"
                  >
                    <Plus className="size-4" />
                    Serbest işlem adı gir
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl border border-border p-3.5">
                    <Input
                      autoFocus
                      placeholder="İşlem adı"
                      value={singleCustomName}
                      onChange={(event) => setSingleCustomName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          confirmSingleCustomTreatment()
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSingleCustomOpen(false)}>
                        Vazgeç
                      </Button>
                      <Button type="button" size="sm" onClick={confirmSingleCustomTreatment} disabled={!singleCustomName.trim()}>
                        Ekle
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {singleTreatmentName && (
              <div className="flex flex-col gap-3 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {singleTreatmentName}
                    <span className="ml-2 font-normal text-muted-foreground">— {singleProvider?.fullName}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="İşlemi kaldır"
                    onClick={() => {
                      setSingleTreatmentName(null)
                      setValue("standaloneTreatmentName", "")
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <MoneyInput value={singlePrice} onChange={changeSinglePrice} placeholder="Fiyat" />
                <ControlDateField value={singleControlDate} onChange={changeSingleControlDate} anchorDate={controlDateAnchor} />
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

export { AppointmentTreatmentSection }

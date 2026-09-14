"use client"

import { Minus, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AssignableStaff } from "@/lib/staff/queries"
import { updateTreatmentPlanItem } from "@/lib/treatment-plans/actions"
import type { TreatmentPlanItemDetail } from "@/lib/treatment-plans/queries"

/**
 * "Kalemi Düzenle" — sağlayıcı, seans sayısı, birim fiyat düzenlenebilir.
 * Sprint 28C: `updateTreatmentPlanItem` Server Action'ını çağırır — kaydedince
 * `revision_no` sunucuda artırılır (istemci sadece sonucu gösterir), en
 * güncel `completedSessions` sunucuda tekrar sorgulanıp altına düşürülmeye
 * karşı korunur.
 */
function TreatmentPlanItemEditSheet({
  item,
  providers,
  open,
  onOpenChange,
}: {
  item: TreatmentPlanItemDetail
  providers: AssignableStaff[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [providerId, setProviderId] = useState(item.providerId)
  const [sessionCount, setSessionCount] = useState(item.sessionCount)
  const [unitPrice, setUnitPrice] = useState<number | undefined>(item.unitPrice ?? undefined)
  const [sessionCountError, setSessionCountError] = useState<string | null>(null)

  // Sheet her açılışta (kapalıyken vazgeçilmiş bir taslak varsa dahi) veya
  // farklı bir kalem için açıldığında taslağı o kalemin güncel değerleriyle
  // sıfırlar — aynı-render prop→state senkronu (bkz. `MoneyInput`'un aynı
  // deseni), bir effect değil.
  const syncKey = open ? item.id : null
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey)
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey)
    if (syncKey !== null) {
      setProviderId(item.providerId)
      setSessionCount(item.sessionCount)
      setUnitPrice(item.unitPrice ?? undefined)
      setSessionCountError(null)
    }
  }

  const minSessionCount = Math.max(1, item.completedSessions)

  function setCount(raw: number) {
    setSessionCount(Math.max(minSessionCount, Math.round(raw) || minSessionCount))
  }

  function handleSave() {
    if (isPending) return
    setSessionCountError(null)
    startTransition(async () => {
      const result = await updateTreatmentPlanItem({
        itemId: item.id,
        providerId,
        treatmentName: item.treatmentName,
        sessionCount,
        unitPrice,
      })
      if (!result?.success) {
        toast.error(result?.error ?? "Kalem güncellenemedi.")
        if (result?.fieldErrors?.sessionCount) setSessionCountError(result.fieldErrors.sessionCount)
        return
      }
      toast.success(`Kalem güncellendi — Değişiklik No: ${result.revisionNo}.`)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Kalemi Düzenle · Rev. {item.revisionNo}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field>
            <FieldLabel htmlFor="edit-item-provider">Hekim</FieldLabel>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger id="edit-item-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field data-invalid={!!sessionCountError}>
            <FieldLabel htmlFor="edit-item-session-count">Seans Sayısı</FieldLabel>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Seans sayısını azalt"
                disabled={sessionCount <= minSessionCount}
                onClick={() => setCount(sessionCount - 1)}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                id="edit-item-session-count"
                type="number"
                min={minSessionCount}
                value={sessionCount}
                onChange={(event) => setCount(event.target.valueAsNumber)}
                className="h-8 w-16 text-center"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Seans sayısını artır" onClick={() => setCount(sessionCount + 1)}>
                <Plus className="size-4" />
              </Button>
            </div>
            {sessionCountError ? (
              <FieldError>{sessionCountError}</FieldError>
            ) : item.completedSessions > 0 ? (
              <p className="text-xs text-muted-foreground">
                {item.completedSessions} seans tamamlandı — bunun altına düşürülemez.
              </p>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-item-unit-price">Birim Fiyat</FieldLabel>
            <MoneyInput id="edit-item-unit-price" value={unitPrice} onChange={setUnitPrice} placeholder="Belirlenmedi" />
          </Field>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            İptal
          </Button>
          <Button type="button" onClick={handleSave} loading={isPending}>
            Kaydet
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export { TreatmentPlanItemEditSheet }

"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarPlus, ChevronLeft, ClipboardList, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createToothTreatment, setToothCondition, updateToothTreatmentStatus } from "@/lib/teeth/actions"
import {
  TOOTH_CONDITION_LABELS,
  TOOTH_TREATMENT_STATUS_BADGE_VARIANT,
  TOOTH_TREATMENT_STATUS_LABELS,
  TOOTH_TREATMENT_TYPE_LABELS,
  type ToothConditionStatus,
} from "@/lib/teeth/constants"
import type { ToothConditionRow, ToothTreatmentRow } from "@/lib/teeth/queries"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { ToothTreatmentForm } from "./tooth-treatment-form"

const CONDITION_OPTIONS = Object.entries(TOOTH_CONDITION_LABELS) as [ToothConditionStatus, string][]

type ToothDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  toothNumber: number
  condition: ToothConditionRow | undefined
  treatments: ToothTreatmentRow[]
  staffOptions: AssignableStaff[]
  catalog: CatalogItem[]
  canManageClinical: boolean
}

function ToothDetailSheet({
  open,
  onOpenChange,
  patientId,
  toothNumber,
  condition,
  treatments,
  staffOptions,
  catalog,
  canManageClinical,
}: ToothDetailSheetProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"view" | "add">("view")
  const [isPending, startTransition] = useTransition()

  const toothTreatments = treatments.filter((treatment) => treatment.toothNumber === toothNumber)

  function handleConditionChange(status: ToothConditionStatus) {
    startTransition(async () => {
      const result = await setToothCondition(patientId, toothNumber, status)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Diş durumu güncellendi.")
      router.refresh()
    })
  }

  function handleMarkCompleted(treatmentId: string) {
    startTransition(async () => {
      const result = await updateToothTreatmentStatus(patientId, treatmentId, "tamamlandi")
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Tedavi tamamlandı olarak işaretlendi.")
      router.refresh()
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setMode("view")
        onOpenChange(next)
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          {mode === "add" ? (
            <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => setMode("view")}>
              <ChevronLeft />
              Geri
            </Button>
          ) : null}
          <SheetTitle>Diş {toothNumber}</SheetTitle>
          <SheetDescription>
            {mode === "add" ? "Bu diş için yeni bir tedavi kaydedin." : "Diş durumu ve tedavi geçmişi."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {mode === "view" ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Güncel Durum</span>
                <Select
                  value={condition?.status ?? "saglikli"}
                  onValueChange={(value) => handleConditionChange(value as ToothConditionStatus)}
                  disabled={isPending || !canManageClinical}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bu klinikte yapılmamış, önceden var olan bir durumu işaretlemek için kullanın. Bu klinikte
                  yapılan tedaviler aşağıya eklendiğinde durum otomatik güncellenir.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tedavi Geçmişi</span>
                  {canManageClinical && (
                    <Button size="sm" variant="outline" onClick={() => setMode("add")}>
                      <Plus />
                      Tedavi Ekle
                    </Button>
                  )}
                </div>

                {toothTreatments.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="Henüz tedavi kaydı yok"
                    description="Bu diş için ilk tedaviyi ekleyin."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {toothTreatments.map((treatment) => (
                      <div key={treatment.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {treatment.treatmentType === "diger"
                              ? treatment.customTreatmentName
                              : TOOTH_TREATMENT_TYPE_LABELS[treatment.treatmentType]}
                          </span>
                          <Badge variant={TOOTH_TREATMENT_STATUS_BADGE_VARIANT[treatment.status]}>
                            {TOOTH_TREATMENT_STATUS_LABELS[treatment.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(`${treatment.performedAt}T00:00:00`), "d MMMM yyyy", { locale: tr })}
                          {treatment.performedByName ? ` · ${treatment.performedByName}` : ""}
                        </p>
                        {treatment.price !== null && (
                          <p className="text-sm text-muted-foreground">{treatment.price.toLocaleString("tr-TR")} TRY</p>
                        )}
                        {treatment.note && <p className="text-sm">{treatment.note}</p>}
                        {treatment.status === "planlandi" && canManageClinical && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => handleMarkCompleted(treatment.id)}
                            >
                              Tamamlandı Olarak İşaretle
                            </Button>
                            {!treatment.appointmentId && (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/appointments/new?patientId=${patientId}&treatmentId=${treatment.id}`}>
                                  <CalendarPlus />
                                  Bu Tedavi İçin Randevu Oluştur
                                </Link>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ToothTreatmentForm
              toothNumber={toothNumber}
              staffOptions={staffOptions}
              catalog={catalog}
              onSubmit={(values) => createToothTreatment(patientId, values)}
              onSuccess={() => {
                setMode("view")
                router.refresh()
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { ToothDetailSheet }

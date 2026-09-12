"use client"

import { Pencil, Stethoscope } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { getInitials } from "@/lib/utils"
import { formatCurrency } from "@/lib/format/currency"
import { setCatalogItemActive } from "@/lib/treatment-catalog/actions"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import { TreatmentCatalogItemSheet } from "./treatment-catalog-item-sheet"

function formatPrice(price: number | null, currency: string): string {
  return price === null ? "Belirlenmedi" : formatCurrency(price, currency)
}

function TreatmentCatalogSection({
  staffId,
  staffName,
  items,
}: {
  staffId: string
  staffName: string
  items: CatalogItem[]
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(staffName)}
          </div>
          <p className="font-medium">{staffName}</p>
        </div>
        <TreatmentCatalogItemSheet staffId={staffId} staffName={staffName} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Stethoscope}
          title="Henüz tedavi eklenmedi"
          description="Bu personel için bir tedavi eklediğinizde burada listelenecek."
        />
      ) : (
        <div className="flex flex-col divide-y">
          {items.map((item) => (
            <CatalogItemRow key={item.id} staffId={staffId} staffName={staffName} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function CatalogItemRow({
  staffId,
  staffName,
  item,
}: {
  staffId: string
  staffName: string
  item: CatalogItem
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await setCatalogItemActive(item.id, checked)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className={item.isActive ? "font-medium" : "text-muted-foreground font-medium line-through"}>
          {item.treatmentType}
        </p>
        <p className="text-muted-foreground text-xs">{formatPrice(item.defaultPrice, item.currency)}</p>
      </div>
      <TreatmentCatalogItemSheet
        staffId={staffId}
        staffName={staffName}
        item={item}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`${item.treatmentType} düzenle`}>
            <Pencil />
          </Button>
        }
      />
      <Switch
        checked={item.isActive}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={`${item.treatmentType} aktif`}
      />
    </div>
  )
}

export { TreatmentCatalogSection }

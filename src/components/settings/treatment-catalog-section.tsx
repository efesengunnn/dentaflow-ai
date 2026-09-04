"use client"

import { Pencil, Stethoscope } from "lucide-react"
import { useRouter } from "next/navigation"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { createCatalogItem, removeCatalogItem, updateCatalogItem } from "@/lib/treatment-catalog/actions"
import { TOOTH_TREATMENT_TYPE_LABELS } from "@/lib/teeth/constants"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import { TreatmentCatalogItemSheet } from "./treatment-catalog-item-sheet"

function TreatmentCatalogSection({ items }: { items: CatalogItem[] }) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <TreatmentCatalogItemSheet mode="create" onSubmit={createCatalogItem} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Henüz işlem tanımlı değil"
          description="Klinik fiyat listenize ilk işlemi ekleyin."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {TOOTH_TREATMENT_TYPE_LABELS[item.treatmentType]}
                    {item.defaultPrice !== null ? ` · ${item.defaultPrice.toLocaleString("tr-TR")} TRY` : ""}
                  </p>
                </div>
                {!item.isActive && <Badge variant="secondary">Pasif</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <TreatmentCatalogItemSheet
                  mode="edit"
                  defaultValues={{
                    treatmentType: item.treatmentType,
                    name: item.name,
                    defaultPrice: item.defaultPrice ?? undefined,
                    isActive: item.isActive,
                  }}
                  onSubmit={(values) => updateCatalogItem(item.id, values)}
                  trigger={
                    <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Düzenle">
                      <Pencil className="size-4" />
                    </button>
                  }
                />
                <EntityDeleteDialog
                  title="İşlem silinsin mi?"
                  description={`"${item.name}" fiyat listesinden kaldırılacak. Bu işlemi kullanan geçmiş tedavi kayıtları etkilenmez.`}
                  onConfirm={async () => {
                    const result = await removeCatalogItem(item.id)
                    router.refresh()
                    return result
                  }}
                  triggerLabel=""
                  triggerVariant="ghost"
                  triggerSize="icon"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { TreatmentCatalogSection }

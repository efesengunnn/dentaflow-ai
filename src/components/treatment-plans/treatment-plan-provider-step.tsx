"use client"

import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { AssignableStaff } from "@/lib/staff/queries"

/**
 * Adım 1 — "Sağlayıcı Seç": tek soru, kart listesi. Seçili kart mavi
 * border + check icon. Sprint 28C — gerçek `staffOptions` (getAssignableStaff)
 * kullanır, artık sahte/mock sağlayıcı ID'si üretmez: `treatment_plan_items.
 * provider_id` gerçek bir `staff_members` FK'ı olduğundan (ve bu çok-kiracılı
 * bir sistem olduğundan) serbest metinle "özel sağlayıcı ekle" seçeneği artık
 * yok — listede olmayan biri için önce Personel ekranından personel kaydı
 * açılmalı.
 */
function TreatmentPlanProviderStep({
  providers,
  selectedProviderId,
  onSelect,
}: {
  providers: AssignableStaff[]
  selectedProviderId: string | null
  onSelect: (provider: AssignableStaff) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Hekim Seç</h3>
        <p className="text-sm text-muted-foreground">Bu plandaki ilk tedaviyi kim uygulayacak?</p>
      </div>

      <div className="flex flex-col gap-2">
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Klinikte atanabilir personel bulunamadı.</p>
        ) : (
          providers.map((provider) => {
            const isSelected = provider.id === selectedProviderId
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => onSelect(provider)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors duration-150 hover:bg-muted/40",
                  isSelected ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <span className="font-medium">{provider.fullName}</span>
                {isSelected && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export { TreatmentPlanProviderStep }

"use client"

import { Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DraftTreatmentSelection } from "./treatment-plan-builder"

/** Adım 3 — "Seans Sayısı": her seçili tedavi için -/+ ve elle giriş, 1'den küçük olamaz. */
function TreatmentPlanSessionsStep({
  selections,
  onChangeSessionCount,
}: {
  selections: DraftTreatmentSelection[]
  onChangeSessionCount: (key: string, count: number) => void
}) {
  function setCount(key: string, raw: number) {
    onChangeSessionCount(key, Math.max(1, Math.round(raw) || 1))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Seans Sayısı</h3>
        <p className="text-sm text-muted-foreground">Her tedavi için toplam seans sayısını girin.</p>
      </div>

      <div className="flex flex-col gap-2">
        {selections.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
            <span className="min-w-0 truncate font-medium">{row.treatmentName}</span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Seans sayısını azalt"
                disabled={row.sessionCount <= 1}
                onClick={() => setCount(row.key, row.sessionCount - 1)}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                min={1}
                value={row.sessionCount}
                onChange={(event) => setCount(row.key, event.target.valueAsNumber)}
                className="h-8 w-14 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Seans sayısını artır"
                onClick={() => setCount(row.key, row.sessionCount + 1)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { TreatmentPlanSessionsStep }

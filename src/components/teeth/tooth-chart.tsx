"use client"

import { Check } from "lucide-react"

import { LOWER_ARCH_TEETH, TOOTH_CONDITION_COLORS, TOOTH_CONDITION_LABELS, UPPER_ARCH_TEETH } from "@/lib/teeth/constants"
import type { ToothConditionRow } from "@/lib/teeth/queries"
import { cn } from "@/lib/utils"

type ToothChartProps = {
  conditions: Map<number, ToothConditionRow>
  onToothClick: (toothNumber: number) => void
  selectedTooth?: number | null
  /** When set (even empty), the chart renders in multi-select mode: every tooth gets a checkmark overlay if its number is in the set, instead of the single-selection ring. */
  multiSelectedTeeth?: Set<number>
}

/**
 * A tooth without a `tooth_conditions` row is implicitly healthy (see the
 * migration) — the chart never distinguishes "explicitly marked healthy"
 * from "never touched", both render identically.
 */
function toothStatusColor(conditions: Map<number, ToothConditionRow>, toothNumber: number): string {
  const condition = conditions.get(toothNumber)
  return TOOTH_CONDITION_COLORS[condition?.status ?? "saglikli"]
}

function ToothButton({
  toothNumber,
  colorClass,
  isSelected,
  isMultiSelected,
  onClick,
}: {
  toothNumber: number
  colorClass: string
  isSelected: boolean
  isMultiSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1"
      aria-label={`Diş ${toothNumber}`}
    >
      <svg
        viewBox="0 0 32 40"
        className={cn(
          "size-8 transition-transform duration-150 group-hover:scale-110 sm:size-9",
          (isSelected || isMultiSelected) && "scale-110",
        )}
      >
        <path
          d="M6 4 C6 1.8 9 0 16 0 C23 0 26 1.8 26 4 L26 22 C26 32 21 40 17 40 C15 40 14.5 34 14.5 30 C14.5 34 14 40 12 40 C8 40 6 32 6 22 Z"
          className={cn(
            colorClass,
            "stroke-[1.5] transition-all duration-150",
            isSelected || isMultiSelected ? "stroke-foreground stroke-2" : "",
          )}
        />
      </svg>
      {isMultiSelected && (
        <span className="absolute -top-1 right-0 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2.5" />
        </span>
      )}
      <span
        className={cn(
          "font-mono text-[0.65rem] text-muted-foreground transition-colors",
          (isSelected || isMultiSelected) && "font-semibold text-foreground",
        )}
      >
        {toothNumber}
      </span>
    </button>
  )
}

function ArchRow({
  teeth,
  conditions,
  selectedTooth,
  multiSelectedTeeth,
  onToothClick,
}: {
  teeth: number[]
  conditions: Map<number, ToothConditionRow>
  selectedTooth?: number | null
  multiSelectedTeeth?: Set<number>
  onToothClick: (toothNumber: number) => void
}) {
  const leftQuadrant = teeth.slice(0, 8)
  const rightQuadrant = teeth.slice(8, 16)

  return (
    <div className="flex items-start justify-center gap-3">
      <div className="flex gap-1">
        {leftQuadrant.map((toothNumber) => (
          <ToothButton
            key={toothNumber}
            toothNumber={toothNumber}
            colorClass={toothStatusColor(conditions, toothNumber)}
            isSelected={selectedTooth === toothNumber}
            isMultiSelected={multiSelectedTeeth?.has(toothNumber) ?? false}
            onClick={() => onToothClick(toothNumber)}
          />
        ))}
      </div>
      <div className="mt-4 h-8 w-px bg-border" />
      <div className="flex gap-1">
        {rightQuadrant.map((toothNumber) => (
          <ToothButton
            key={toothNumber}
            toothNumber={toothNumber}
            colorClass={toothStatusColor(conditions, toothNumber)}
            isSelected={selectedTooth === toothNumber}
            isMultiSelected={multiSelectedTeeth?.has(toothNumber) ?? false}
            onClick={() => onToothClick(toothNumber)}
          />
        ))}
      </div>
    </div>
  )
}

const LEGEND_STATUSES: (keyof typeof TOOTH_CONDITION_LABELS)[] = [
  "saglikli",
  "curuk",
  "dolgulu",
  "kanal_tedavili",
  "kaplamali",
  "implant",
  "kopru_ayagi",
  "eksik",
]

function ToothChart({ conditions, onToothClick, selectedTooth, multiSelectedTeeth }: ToothChartProps) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6">
      <ArchRow
        teeth={UPPER_ARCH_TEETH}
        conditions={conditions}
        selectedTooth={selectedTooth}
        multiSelectedTeeth={multiSelectedTeeth}
        onToothClick={onToothClick}
      />
      <div className="h-px w-full max-w-md bg-border" />
      <ArchRow
        teeth={LOWER_ARCH_TEETH}
        conditions={conditions}
        selectedTooth={selectedTooth}
        multiSelectedTeeth={multiSelectedTeeth}
        onToothClick={onToothClick}
      />

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
        {LEGEND_STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <svg viewBox="0 0 32 40" className="size-3">
              <path
                d="M6 4 C6 1.8 9 0 16 0 C23 0 26 1.8 26 4 L26 22 C26 32 21 40 17 40 C15 40 14.5 34 14.5 30 C14.5 34 14 40 12 40 C8 40 6 32 6 22 Z"
                className={cn(TOOTH_CONDITION_COLORS[status], "stroke-1")}
              />
            </svg>
            {TOOTH_CONDITION_LABELS[status]}
          </div>
        ))}
      </div>
    </div>
  )
}

export { ToothChart }

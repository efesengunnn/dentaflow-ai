"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  archesForMode,
  DENTITION_MODE_LABELS,
  DENTITION_MODES,
  getDefaultDentition,
  sortTeeth,
  type DentitionMode,
  type ToothArch,
} from "@/lib/odontogram/fdi"
import { cn } from "@/lib/utils"

/**
 * Interactive FDI / ISO 3950 odontogram — a controlled tooth picker. The
 * founder-approved single source for charting which teeth a treatment applies
 * to (Sprint 33). Deliberately self-contained and dumb: it owns only the
 * Daimi/Süt/Karışık view toggle; the selected teeth are fully controlled by
 * the parent via `value`/`onChange`, so the same chart drops into the plan
 * wizard, the item edit sheet, and any future dental-chart screen unchanged.
 *
 * `birthDate` only picks which dentition the chart OPENS on (age-based, the
 * clinical convention) — the user can always switch. Selection is optional by
 * design: no teeth means "whole-mouth / not tooth-specific", a valid state
 * for scaling, whitening, dentures, x-rays, etc.
 */
function ToothButton({
  number,
  selected,
  disabled,
  onToggle,
}: {
  number: number
  selected: boolean
  disabled?: boolean
  onToggle: (number: number) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Diş ${number}`}
      disabled={disabled}
      onClick={() => onToggle(number)}
      className={cn(
        "flex h-9 w-8 shrink-0 items-center justify-center rounded-md border text-[11px] font-medium tabular-nums transition-colors duration-150 outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
      )}
    >
      {number}
    </button>
  )
}

function ToothRow({
  right,
  left,
  value,
  disabled,
  onToggle,
}: {
  right: number[]
  left: number[]
  value: number[]
  disabled?: boolean
  onToggle: (number: number) => void
}) {
  const selectedSet = new Set(value)
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex gap-1">
        {right.map((number) => (
          <ToothButton key={number} number={number} selected={selectedSet.has(number)} disabled={disabled} onToggle={onToggle} />
        ))}
      </div>
      {/* Midline — the anatomical center between the two halves of the arch. */}
      <div className="bg-border h-9 w-px shrink-0" aria-hidden />
      <div className="flex gap-1">
        {left.map((number) => (
          <ToothButton key={number} number={number} selected={selectedSet.has(number)} disabled={disabled} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

function ArchBlock({
  arch,
  showLabel,
  value,
  disabled,
  onToggle,
}: {
  arch: ToothArch
  showLabel: boolean
  value: number[]
  disabled?: boolean
  onToggle: (number: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <p className="text-muted-foreground text-center text-[11px] font-medium tracking-wide uppercase">{arch.label}</p>
      )}
      <ToothRow right={arch.upperRight} left={arch.upperLeft} value={value} disabled={disabled} onToggle={onToggle} />
      <ToothRow right={arch.lowerRight} left={arch.lowerLeft} value={value} disabled={disabled} onToggle={onToggle} />
    </div>
  )
}

function Odontogram({
  value,
  onChange,
  birthDate,
  disabled,
  className,
}: {
  value: number[]
  onChange: (numbers: number[]) => void
  birthDate?: string | null
  disabled?: boolean
  className?: string
}) {
  const [mode, setMode] = useState<DentitionMode>(() => getDefaultDentition(birthDate))
  const arches = archesForMode(mode)

  function toggle(number: number) {
    if (disabled) return
    onChange(value.includes(number) ? value.filter((tooth) => tooth !== number) : sortTeeth([...value, number]))
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="bg-muted inline-flex rounded-lg p-0.5" role="group" aria-label="Diş tipi">
          {DENTITION_MODES.map((option) => {
            const active = mode === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(option)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 outline-none",
                  "focus-visible:ring-ring/50 focus-visible:ring-[2px]",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {DENTITION_MODE_LABELS[option]}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {value.length > 0 ? `${value.length} diş seçili` : "Diş seçilmedi"}
          </span>
          {value.length > 0 && !disabled && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
              Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Small screens: let the arches scroll horizontally rather than squeeze
          the tooth targets below a usable size. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="mx-auto flex w-fit flex-col gap-4 py-1">
          {arches.map((arch) => (
            <ArchBlock
              key={arch.mode}
              arch={arch}
              showLabel={arches.length > 1}
              value={value}
              disabled={disabled}
              onToggle={toggle}
            />
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Bu tedavinin uygulanacağı dişleri işaretleyin. Tüm ağzı ilgilendiren tedavilerde boş bırakabilirsiniz.
      </p>
    </div>
  )
}

export { Odontogram }

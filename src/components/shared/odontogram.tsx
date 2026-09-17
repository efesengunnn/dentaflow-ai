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
/**
 * A single generic tooth silhouette (crown dome + two roots), drawn once and
 * reused for every position. A single refined glyph reads more premium/minimal
 * (Apple/Linear) than a busy set of per-type anatomical shapes; `flip` mirrors
 * it vertically so upper-jaw crowns point down and lower-jaw crowns point up,
 * meeting at the midline like a real bite.
 */
function ToothGlyph({ selected, flip }: { selected: boolean; flip: boolean }) {
  return (
    <svg
      viewBox="0 0 32 34"
      aria-hidden
      className={cn(
        "h-9 w-8 shrink-0 transition-[fill,stroke,filter] duration-150",
        selected
          ? "fill-primary stroke-primary drop-shadow-[0_1.5px_2px_rgb(0_0_0/0.20)]"
          : "fill-muted stroke-muted-foreground/45 group-hover:fill-primary/15 group-hover:stroke-primary/55",
      )}
      strokeWidth={1.75}
      strokeLinejoin="round"
    >
      {/* Mirror upper-jaw teeth in SVG user units (deterministic — a CSS
          scale transform-origin on the <svg> proved unreliable) so their
          crowns point down toward the bite line. Path + enamel sheen share the
          group so the highlight flips with the crown. */}
      <g transform={flip ? "translate(0 34) scale(1 -1)" : undefined}>
        <path d="M16 3.5C11.6 3.5 7.5 5.2 7.5 10c0 3 .9 5.2 1.4 8 .5 2.8.3 6.5 1.1 10.5.4 2.1 2 2.3 2.6.3.8-2.8 1-7.3 3.4-7.3s2.6 4.5 3.4 7.3c.6 2 2.2 1.8 2.6-.3.8-4 .6-7.7 1.1-10.5.5-2.8 1.4-5 1.4-8 0-4.8-4.1-6.5-8.5-6.5z" />
        {/* Enamel sheen — a soft highlight near the crown that lifts the
            selected tooth from flat fill to a glossy, premium surface. */}
        {selected && (
          <ellipse cx="12.5" cy="9.5" rx="4" ry="2.3" transform="rotate(-22 12.5 9.5)" className="fill-white/35" stroke="none" />
        )}
      </g>
    </svg>
  )
}

function ToothButton({
  number,
  selected,
  disabled,
  orientation,
  onToggle,
}: {
  number: number
  selected: boolean
  disabled?: boolean
  /** "upper" = upper jaw (crown points down, number sits above); "lower" = the mirror. */
  orientation: "upper" | "lower"
  onToggle: (number: number) => void
}) {
  const label = (
    <span
      className={cn(
        "text-[10px] leading-none tabular-nums transition-colors duration-150",
        selected ? "text-primary font-semibold" : "text-muted-foreground",
      )}
    >
      {number}
    </span>
  )
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Diş ${number}`}
      disabled={disabled}
      onClick={() => onToggle(number)}
      className={cn(
        "group flex shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-1 outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {orientation === "upper" && label}
      <ToothGlyph selected={selected} flip={orientation === "upper"} />
      {orientation === "lower" && label}
    </button>
  )
}

function ToothRow({
  right,
  left,
  orientation,
  value,
  disabled,
  onToggle,
}: {
  right: number[]
  left: number[]
  orientation: "upper" | "lower"
  value: number[]
  disabled?: boolean
  onToggle: (number: number) => void
}) {
  const selectedSet = new Set(value)
  return (
    <div className="flex items-stretch justify-center gap-2">
      <div className="flex gap-0.5">
        {right.map((number) => (
          <ToothButton key={number} number={number} orientation={orientation} selected={selectedSet.has(number)} disabled={disabled} onToggle={onToggle} />
        ))}
      </div>
      {/* Midline — the anatomical center between the two halves of the arch. */}
      <div className="bg-border/70 w-px shrink-0 self-stretch" aria-hidden />
      <div className="flex gap-0.5">
        {left.map((number) => (
          <ToothButton key={number} number={number} orientation={orientation} selected={selectedSet.has(number)} disabled={disabled} onToggle={onToggle} />
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
      <ToothRow right={arch.upperRight} left={arch.upperLeft} orientation="upper" value={value} disabled={disabled} onToggle={onToggle} />
      <ToothRow right={arch.lowerRight} left={arch.lowerLeft} orientation="lower" value={value} disabled={disabled} onToggle={onToggle} />
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

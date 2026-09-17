"use client"

/* eslint-disable @next/next/no-img-element -- the teeth are 52 tiny local
   PNG tiles rendered fluid-width in a grid; next/image's per-image width/height
   + optimization pipeline adds no value here and fights the responsive layout. */

import { useState } from "react"

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
 * Interactive FDI / ISO 3950 odontogram — a controlled tooth picker (Sprint
 * 33). Each tooth is a photorealistic image tile (`public/odontogram/<fdi>.png`,
 * sliced from the founder-approved rendered chart), laid out on a light
 * "clinical viewer" panel whose colour matches the tiles' background so they
 * blend seamlessly. Selection is shown as a tinted card + ring around the tooth
 * (the baked tooth image can't be recoloured). The chart owns only the
 * Daimi/Süt/Karışık view toggle; selected teeth are fully controlled by the
 * parent via `value`/`onChange`.
 *
 * `birthDate` only picks which dentition the chart OPENS on (age-based) — the
 * user can always switch. Selection is optional: no teeth means "whole-mouth /
 * not tooth-specific".
 */

// Matches the background baked into the tooth PNG tiles, so a tile's own
// rectangle is invisible against the panel.
const PANEL_BG = "#f6f8fb"

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
  /** "upper" = upper jaw (number sits above the crown); "lower" = number below. */
  orientation: "upper" | "lower"
  onToggle: (number: number) => void
}) {
  const label = (
    <span
      className={cn(
        "text-[11px] leading-none tabular-nums transition-colors duration-150",
        selected ? "text-primary font-semibold" : "text-slate-500",
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
        "group flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 rounded-xl px-1 py-2 outline-none transition-colors duration-150",
        "max-w-[104px] focus-visible:ring-primary/50 focus-visible:ring-2",
        selected ? "bg-primary/15 ring-primary ring-2 ring-inset" : "hover:bg-primary/8",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {orientation === "upper" && label}
      <img
        src={`/odontogram/${number}.png?v=2`}
        alt=""
        draggable={false}
        className={cn(
          "h-auto w-full max-w-[92px] select-none transition-transform duration-150 group-hover:scale-[1.06]",
          selected && "scale-[1.06]",
        )}
      />
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
    <div className="flex w-full items-stretch justify-center gap-1.5">
      <div className="flex flex-1 justify-center gap-0.5">
        {right.map((number) => (
          <ToothButton key={number} number={number} orientation={orientation} selected={selectedSet.has(number)} disabled={disabled} onToggle={onToggle} />
        ))}
      </div>
      {/* Midline — the anatomical center between the two halves of the arch. */}
      <div className="w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-slate-300/80 to-transparent" aria-hidden />
      <div className="flex flex-1 justify-center gap-0.5">
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
    <div className="flex w-full flex-col gap-1">
      {showLabel && (
        <p className="text-center text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{arch.label}</p>
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
    <div className={cn("flex flex-col gap-2.5", className)}>
      {/* A premium white card containing the light "viewer" strip — depth from
          a soft layered shadow + hairline border, teeth seamless on the inner
          panel whose colour matches the tiles' baked background. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_32px_-18px_rgb(15_23_42/0.20)] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5" role="group" aria-label="Diş tipi">
            {DENTITION_MODES.map((option) => {
              const active = mode === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(option)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 outline-none",
                    "focus-visible:ring-primary/40 focus-visible:ring-2",
                    active
                      ? "bg-slate-800 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {DENTITION_MODE_LABELS[option]}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs tabular-nums transition-colors duration-150",
                value.length > 0 ? "border-primary/30 bg-primary/5 text-primary font-medium" : "border-slate-200 bg-white text-slate-500",
              )}
            >
              {value.length > 0 ? `${value.length} diş seçili` : "Diş seçilmedi"}
            </span>
            {value.length > 0 && !disabled && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Teeth scale to width (no horizontal scroll) so a full arch is always
            visible at once. */}
        <div className="flex w-full flex-col gap-5 rounded-xl px-2 py-3 sm:px-3" style={{ backgroundColor: PANEL_BG }}>
          {arches.map((arch) => (
            <ArchBlock key={arch.mode} arch={arch} showLabel={arches.length > 1} value={value} disabled={disabled} onToggle={toggle} />
          ))}
        </div>
      </div>

      <p className="text-muted-foreground px-1 text-xs">
        Bu tedavinin uygulanacağı dişleri işaretleyin. Tüm ağzı ilgilendiren tedavilerde boş bırakabilirsiniz.
      </p>
    </div>
  )
}

export { Odontogram }

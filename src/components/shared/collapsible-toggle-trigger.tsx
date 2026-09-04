"use client"

import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

import { CollapsibleTrigger } from "@/components/ui/collapsible"

/**
 * The "Diğer Bilgiler (opsiyonel)" / "+ Tedavi Tanımla" / "Geçmiş Tedaviler (N)"
 * chevron-toggle button — previously hand-typed identically in five places.
 * `group` is required on the button itself (not just present in some copies)
 * for the chevron's `group-data-[state=open]:rotate-180` to work — one copy
 * had silently dropped it and never rotated.
 */
function CollapsibleToggleTrigger({ children }: { children: ReactNode }) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className="size-4 shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180" />
        {children}
      </button>
    </CollapsibleTrigger>
  )
}

export { CollapsibleToggleTrigger }

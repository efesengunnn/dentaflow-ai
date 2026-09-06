"use client"

import { Sparkles } from "lucide-react"
import { useState } from "react"

import { AIPanelChat } from "@/components/ai/ai-panel-chat"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

/**
 * Global entry point for the AI panel (Sprint 27) — mounted once in
 * `src/app/(app)/layout.tsx` so it's reachable from every page, Dashboard
 * included. Floating bottom-right launcher, opens a right-side Sheet (the
 * same primitive/mobile behavior every other panel in the app already uses —
 * no bespoke bottom-sheet needed for "mobil uyumlu").
 */
function AIPanelLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="AI Asistanı Aç"
          className="from-primary to-primary/70 fixed right-5 bottom-5 z-40 flex size-12 items-center justify-center rounded-full bg-gradient-to-br text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:right-6 md:bottom-6"
        >
          <Sparkles className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Asistan
          </SheetTitle>
          <SheetDescription>Klinik hafızası ve takip asistanı — otomatik mesaj göndermez.</SheetDescription>
        </SheetHeader>
        <AIPanelChat />
      </SheetContent>
    </Sheet>
  )
}

export { AIPanelLauncher }

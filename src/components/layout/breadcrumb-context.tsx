"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type BreadcrumbContextValue = {
  label: string | null
  setLabel: (label: string | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null)
  return (
    <BreadcrumbContext.Provider value={{ label, setLabel }}>{children}</BreadcrumbContext.Provider>
  )
}

function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext)
  if (!ctx) throw new Error("useBreadcrumbContext must be used within BreadcrumbProvider")
  return ctx
}

/**
 * Lets a dynamic-route page (Lead/Patient Detail) supply the record's real
 * name as the trailing breadcrumb segment — `getBreadcrumbTrail` is a pure
 * function of `pathname` alone and has no way to know "Ahmet Yılmaz" without
 * this. Resets to null on unmount so navigating away doesn't leak the label
 * onto the next route before its own effect (if any) runs.
 */
function useDynamicBreadcrumb(label: string | undefined) {
  const { setLabel } = useBreadcrumbContext()
  useEffect(() => {
    setLabel(label ?? null)
    return () => setLabel(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label])
}

export { BreadcrumbProvider, useBreadcrumbContext, useDynamicBreadcrumb }

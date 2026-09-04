"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useRef, useState } from "react"

/**
 * URL-driven filter state shared by `LeadFilters` and `PatientFilters`:
 * debounced search input, and a generic `updateParams` for the select
 * filters (status/origin, assigned staff). Extracted once Patients made the
 * duplication concrete — the actual filter *options* (which selects, which
 * values) stay in each module's own `*-filters.tsx`, since those genuinely
 * differ per entity.
 */
function useEntityFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParams({ search: value || null }), 400)
  }

  return { searchParams, searchValue, handleSearchChange, updateParams }
}

export { useEntityFilters }

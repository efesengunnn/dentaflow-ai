"use client"

import { FilterBar } from "@/components/shared/filter-bar"
import { SearchInput } from "@/components/ui/search-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEntityFilters } from "@/hooks/use-entity-filters"
import { PATIENT_ORIGIN_OPTIONS } from "@/lib/patients/constants"

function PatientFilters() {
  const { searchParams, searchValue, handleSearchChange, updateParams } = useEntityFilters()

  return (
    <FilterBar
      search={
        <SearchInput
          value={searchValue}
          onChange={(event) => handleSearchChange(event.target.value)}
          onClear={() => handleSearchChange("")}
          placeholder="İsim, telefon veya e-posta ara..."
        />
      }
      filters={
        <>
          <Select
            value={searchParams.get("origin") ?? "all"}
            onValueChange={(value) => updateParams({ origin: value === "all" ? null : value })}
          >
            <SelectTrigger size="sm" className="w-[168px]">
              <SelectValue placeholder="Hasta Tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Hastalar</SelectItem>
              {PATIENT_ORIGIN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}

export { PatientFilters }

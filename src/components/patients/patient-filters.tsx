"use client"

import { FilterBar } from "@/components/shared/filter-bar"
import { SearchInput } from "@/components/ui/search-input"
import { useEntityFilters } from "@/hooks/use-entity-filters"

function PatientFilters() {
  const { searchValue, handleSearchChange } = useEntityFilters()

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
    />
  )
}

export { PatientFilters }

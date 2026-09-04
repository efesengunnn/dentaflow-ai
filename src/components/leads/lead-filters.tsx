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
import { LEAD_STATUS_OPTIONS } from "@/lib/leads/constants"
import type { AssignableStaff } from "@/lib/staff/queries"

type LeadFiltersProps = {
  staffOptions: AssignableStaff[]
}

function LeadFilters({ staffOptions }: LeadFiltersProps) {
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
            value={searchParams.get("status") ?? "all"}
            onValueChange={(value) => updateParams({ status: value === "all" ? null : value })}
          >
            <SelectTrigger size="sm" className="w-[168px]">
              <SelectValue placeholder="Tüm Durumlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              {LEAD_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("assignedTo") ?? "all"}
            onValueChange={(value) =>
              updateParams({ assignedTo: value === "all" ? null : value })
            }
          >
            <SelectTrigger size="sm" className="w-[168px]">
              <SelectValue placeholder="Tüm Personel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Personel</SelectItem>
              {staffOptions.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}

export { LeadFilters }

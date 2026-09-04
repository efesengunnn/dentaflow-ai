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
import { APPOINTMENT_STATUS_OPTIONS } from "@/lib/appointments/constants"
import type { AssignableStaff } from "@/lib/staff/queries"

type AppointmentFiltersProps = {
  staffOptions: AssignableStaff[]
}

function AppointmentFilters({ staffOptions }: AppointmentFiltersProps) {
  const { searchParams, searchValue, handleSearchChange, updateParams } = useEntityFilters()

  return (
    <FilterBar
      search={
        <SearchInput
          value={searchValue}
          onChange={(event) => handleSearchChange(event.target.value)}
          onClear={() => handleSearchChange("")}
          placeholder="Hasta adı, telefon veya sebep ara..."
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
              {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("staffId") ?? "all"}
            onValueChange={(value) => updateParams({ staffId: value === "all" ? null : value })}
          >
            <SelectTrigger size="sm" className="w-[168px]">
              <SelectValue placeholder="Tüm Sağlayıcılar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Sağlayıcılar</SelectItem>
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

export { AppointmentFilters }

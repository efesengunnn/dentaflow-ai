"use client"

import { FilterBar } from "@/components/shared/filter-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEntityFilters } from "@/hooks/use-entity-filters"
import { TREATMENT_PLAN_STATUS_OPTIONS } from "@/lib/treatment-plans/constants"

function PackageFilters() {
  const { searchParams, updateParams } = useEntityFilters()

  return (
    <FilterBar
      filters={
        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(value) => updateParams({ status: value === "all" ? null : value })}
        >
          <SelectTrigger size="sm" className="w-[168px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Paketler</SelectItem>
            {TREATMENT_PLAN_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  )
}

export { PackageFilters }

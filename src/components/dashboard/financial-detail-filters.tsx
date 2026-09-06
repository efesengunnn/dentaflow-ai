"use client"

import { XIcon } from "lucide-react"

import { FilterBar } from "@/components/shared/filter-bar"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AssignableStaff } from "@/lib/staff/queries"

type FinancialDetailFiltersProps = {
  staffOptions: AssignableStaff[]
  staffId: string
  onStaffIdChange: (value: string) => void
  dateFrom: Date | undefined
  onDateFromChange: (date: Date | undefined) => void
  dateTo: Date | undefined
  onDateToChange: (date: Date | undefined) => void
  onReset: () => void
  hasActiveFilters: boolean
}

/**
 * Shared staff + date-range filter row for both Dashboard financial
 * drill-downs (Sprint 9) — the exact same three controls in both Sheets, so
 * this is the one genuinely shared piece rather than duplicating it per
 * screen. Reuses `FilterBar` (structural shell, Sprint 3) and `DatePicker`
 * (Sprint 7) as-is — no new filter primitives.
 */
function FinancialDetailFilters({
  staffOptions,
  staffId,
  onStaffIdChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onReset,
  hasActiveFilters,
}: FinancialDetailFiltersProps) {
  return (
    <FilterBar
      filters={
        <>
          <DatePicker
            value={dateFrom}
            onChange={onDateFromChange}
            placeholder="Başlangıç Tarihi"
            className="w-[168px]"
          />
          <DatePicker
            value={dateTo}
            onChange={onDateToChange}
            placeholder="Bitiş Tarihi"
            className="w-[168px]"
          />
          <Select value={staffId} onValueChange={onStaffIdChange}>
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
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <XIcon />
              Filtreleri Temizle
            </Button>
          )}
        </>
      }
    />
  )
}

export { FinancialDetailFilters }

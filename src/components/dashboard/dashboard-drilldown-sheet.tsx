"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { DataTable } from "@/components/ui/data-table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type DashboardDrilldownSheetProps<TData extends { patientId: string }> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Filter row (Sprint 9), rendered between the header and the table — optional so a future simple drill-down isn't forced to have one. */
  filters?: ReactNode
  columns: ColumnDef<TData, unknown>[]
  rows: TData[]
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  enableSorting?: boolean
}

/**
 * Shared Sheet + `DataTable` shell for both Dashboard financial drill-downs
 * (Sprint 8.5, filters/sorting added Sprint 9) — the only thing that differs
 * between "Bu Ay Toplam Ciro" and "Bekleyen Bakiye" is the columns/rows/
 * filter predicates, so this is the one genuinely shared piece rather than
 * two near-duplicate files. Every row click navigates to the patient's card,
 * same "click a row, go to its record" convention as every list table
 * already in this app (`EntityTableSection`).
 */
function DashboardDrilldownSheet<TData extends { patientId: string }>({
  open,
  onOpenChange,
  title,
  description,
  filters,
  columns,
  rows,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  enableSorting,
}: DashboardDrilldownSheetProps<TData>) {
  const router = useRouter()

  // Sprint 10: prefetch every visible row's patient route while the Sheet is
  // open, so the click-through to "Hasta Kartı" feels instant instead of
  // waiting on an RSC fetch triggered only at click time. Bounded by
  // `rows.length` (a single pilot clinic's filtered result set — realistically
  // a handful to a few dozen), deduped since the same patient often appears
  // in multiple ledger rows.
  useEffect(() => {
    if (!open) return
    const uniquePatientIds = new Set(rows.map((row) => row.patientId))
    for (const patientId of uniquePatientIds) {
      router.prefetch(`/patients/${patientId}`)
    }
  }, [open, rows, router])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {filters}
          <DataTable
            columns={columns}
            data={rows}
            enableSorting={enableSorting}
            onRowClick={(row) => {
              onOpenChange(false)
              router.push(`/patients/${row.patientId}`)
            }}
            emptyIcon={emptyIcon}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { DashboardDrilldownSheet }

"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon, type LucideIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"

type EntityTableSectionProps<TData extends { id: string }> = {
  columns: ColumnDef<TData, unknown>[]
  rows: TData[]
  total: number
  page: number
  pageSize: number
  getRowHref: (row: TData) => string
  renderCard: (row: TData) => ReactNode
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
}

/**
 * Generic desktop-table / mobile-card / pagination-footer scaffolding —
 * lifted out of `LeadTableSection` (Sprint 3) when Patients (Sprint 4)
 * needed the exact same structure. Only the columns, row-card renderer, and
 * navigation target differ per module; the responsive split and pagination
 * math are identical, so this is the one part of the List pattern that's a
 * real (not forced) shared component.
 */
function EntityTableSection<TData extends { id: string }>({
  columns,
  rows,
  total,
  page,
  pageSize,
  getRowHref,
  renderCard,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: EntityTableSectionProps<TData>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function goToPage(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(targetPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  const rangeStart = total > 0 ? (page - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(total, page * pageSize)
  const hasNoResults = rows.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(getRowHref(row))}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {hasNoResults ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          rows.map((row) => <div key={row.id}>{renderCard(row)}</div>)
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {rangeStart}–{rangeEnd} / {total} kayıt
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeftIcon />
              Önceki
            </Button>
            <span className="tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => goToPage(page + 1)}
            >
              Sonraki
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { EntityTableSection }

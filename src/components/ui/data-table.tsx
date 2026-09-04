"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DataTablePagination = {
  pageIndex: number
  pageSize: number
  total: number
  onPageChange: (pageIndex: number) => void
}

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: TData) => void
  /**
   * Manual (server-driven) pagination — `data` is expected to already be
   * just the current page's rows. Added in Sprint 3 (Lead List), the first
   * real consumer; per Sprint 2.5's scope note, this extends the same
   * `useReactTable` call rather than a rewrite. Filtering/selection/export
   * still don't exist here — add them the same way, when a module actually
   * needs them.
   */
  pagination?: DataTablePagination
  /**
   * Opt-in client-side sorting (Sprint 9, first consumer: the Dashboard
   * financial drill-downs). Off by default so every existing table
   * (Leads/Patients/Appointments) renders exactly as before — only a column
   * with `enableSorting: true` in its own `ColumnDef` becomes clickable when
   * this is on.
   */
  enableSorting?: boolean
}

function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  emptyIcon: EmptyIcon = InboxIcon,
  emptyTitle = "Henüz kayıt yok",
  emptyDescription,
  onRowClick,
  pagination,
  enableSorting = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting && {
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
      state: { sorting },
    }),
  })

  const rows = table.getRowModel().rows
  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 0
  const rangeStart = pagination && pagination.total > 0 ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const rangeEnd = pagination
    ? Math.min(pagination.total, (pagination.pageIndex + 1) * pagination.pageSize)
    : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border shadow-xs">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : enableSorting && header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="-mx-1 flex items-center gap-1 rounded px-1 hover:text-foreground"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ArrowUpIcon className="size-3.5" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ArrowDownIcon className="size-3.5" />
                      ) : (
                        <ArrowUpDownIcon className="text-muted-foreground/50 size-3.5" />
                      )}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-transparent">
                {columns.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton className="h-5 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onRowClick(row.original)
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                className={
                  onRowClick
                    ? "cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:-outline-offset-2"
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState
                  icon={EmptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
      {pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {rangeStart}–{rangeEnd} / {pagination.total} kayıt
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.pageIndex <= 0}
              onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
            >
              <ChevronLeftIcon />
              Önceki
            </Button>
            <span className="tabular-nums">
              {pagination.pageIndex + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.pageIndex + 1 >= pageCount}
              onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
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

export { DataTable }
export type { DataTableProps }

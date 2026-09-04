"use client"

import { Users } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { StaffDeleteDialog } from "@/components/staff/staff-delete-dialog"
import { StaffEditSheet } from "@/components/staff/staff-edit-sheet"
import { StaffStatusAction } from "@/components/staff/staff-status-action"
import { buildStaffColumns } from "@/components/staff/staff-columns"
import { ROLE_LABELS } from "@/lib/staff/constants"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { getInitials } from "@/lib/utils"
import type { StaffMemberRow } from "@/lib/staff/queries"

/**
 * A clinic's team is small (a handful to a few dozen people), never a
 * paged list — so unlike `EntityTableSection` (built around "click a row to
 * open its detail page," with URL-driven pagination) this renders the full
 * roster directly and puts actions inline in the row, matching how
 * `StaffPermissionRow`'s Roller table already works. Genuinely a different
 * interaction shape, not a forced reuse.
 */
function StaffListSection({ rows, canManage }: { rows: StaffMemberRow[]; canManage: boolean }) {
  const columns = buildStaffColumns((row) =>
    canManage ? (
      <>
        <StaffEditSheet staff={row} />
        <StaffStatusAction staff={row} />
        <StaffDeleteDialog staffId={row.id} staffName={row.fullName} />
      </>
    ) : null,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={rows}
          emptyIcon={Users}
          emptyTitle="Henüz personel yok"
          emptyDescription="İlk ekip üyenizi davet ettiğinizde burada listelenmeye başlayacak."
        />
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Henüz personel yok"
            description="İlk ekip üyenizi davet ettiğinizde burada listelenmeye başlayacak."
          />
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-2xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(row.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.fullName}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.phone ? formatTurkishPhoneDisplay(row.phone) : "Telefon yok"}
                  </p>
                </div>
                {row.isActive ? (
                  <Badge variant="success">Aktif</Badge>
                ) : (
                  <Badge variant="outline">Pasif</Badge>
                )}
              </div>
              <Badge variant="secondary" className="w-fit">
                {ROLE_LABELS[row.role]}
              </Badge>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <StaffEditSheet staff={row} />
                  <StaffStatusAction staff={row} />
                  <StaffDeleteDialog staffId={row.id} staffName={row.fullName} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export { StaffListSection }

"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { ROLE_LABELS } from "@/lib/staff/constants"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { getInitials } from "@/lib/utils"
import type { StaffMemberRow } from "@/lib/staff/queries"

/** Actions column is rendered by the caller (`StaffListSection`) via a Server-Action-aware cell, not defined here — keeps this file free of client mutation wiring, matching `patientColumns`. */
function buildStaffColumns(renderActions: (row: StaffMemberRow) => React.ReactNode): ColumnDef<StaffMemberRow>[] {
  return [
    {
      accessorKey: "fullName",
      header: "Ad Soyad",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(row.original.fullName)}
          </div>
          <span className="font-medium">{row.original.fullName}</span>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Telefon",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.original.phone ? formatTurkishPhoneDisplay(row.original.phone) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: "Rol",
      cell: ({ row }) => <Badge variant="secondary">{ROLE_LABELS[row.original.role]}</Badge>,
    },
    {
      accessorKey: "isActive",
      header: "Durum",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="outline">Pasif</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <div className="flex justify-end gap-2">{renderActions(row.original)}</div>,
    },
  ]
}

export { buildStaffColumns }

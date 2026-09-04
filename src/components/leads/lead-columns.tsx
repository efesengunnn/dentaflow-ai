"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { TruncatedCell } from "@/components/shared/truncated-cell"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { LEAD_SOURCE_LABELS } from "@/lib/leads/constants"
import type { LeadListRow } from "@/lib/leads/queries"
import { LeadStatusBadge } from "./lead-status-badge"

const leadColumns: ColumnDef<LeadListRow>[] = [
  {
    accessorKey: "fullName",
    header: "Ad Soyad",
    cell: ({ row }) => (
      <TruncatedCell value={row.original.fullName} maxWidthClassName="max-w-52" bold />
    ),
  },
  {
    accessorKey: "phone",
    header: "Telefon",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{formatTurkishPhoneDisplay(row.original.phone)}</span>
    ),
  },
  {
    accessorKey: "source",
    header: "Kaynak",
    cell: ({ row }) => LEAD_SOURCE_LABELS[row.original.source],
  },
  {
    accessorKey: "status",
    header: "Durum",
    cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "assignedToName",
    header: "Sorumlu Personel",
    cell: ({ row }) => <TruncatedCell value={row.original.assignedToName} />,
  },
]

export { leadColumns }

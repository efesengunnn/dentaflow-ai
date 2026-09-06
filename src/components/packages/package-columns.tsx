"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

import { TruncatedCell } from "@/components/shared/truncated-cell"
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status-badge"
import type { TreatmentPlanListRow } from "@/lib/treatment-plans/queries"

function formatMoney(amount: number | null): string {
  return amount === null ? "Belirlenmedi" : `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

const packageColumns: ColumnDef<TreatmentPlanListRow>[] = [
  {
    accessorKey: "patientName",
    header: "Hasta",
    cell: ({ row }) => <TruncatedCell value={row.original.patientName} maxWidthClassName="max-w-52" bold />,
  },
  {
    accessorKey: "planName",
    header: "Paket",
    cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.planName}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Oluşturma Tarihi",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {format(new Date(row.original.createdAt), "d MMM yyyy", { locale: tr })}
      </span>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: "Toplam Tutar",
    cell: ({ row }) => <span className="font-medium tabular-nums">{formatMoney(row.original.totalAmount)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    cell: ({ row }) => <TreatmentPlanStatusBadge status={row.original.status} />,
  },
]

export { packageColumns }

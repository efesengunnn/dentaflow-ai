"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

import { TruncatedCell } from "@/components/shared/truncated-cell"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { getInitials } from "@/lib/utils"
import { AppointmentStatusBadge } from "./appointment-status-badge"

const appointmentColumns: ColumnDef<AppointmentListRow>[] = [
  {
    accessorKey: "startsAt",
    header: "Tarih / Saat",
    cell: ({ row }) => (
      <span className="font-mono text-sm whitespace-nowrap">
        {format(new Date(row.original.startsAt), "d MMM yyyy, HH:mm", { locale: tr })}
      </span>
    ),
  },
  {
    accessorKey: "patientName",
    header: "Hasta",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-semibold text-primary">
          {getInitials(row.original.patientName)}
        </div>
        <TruncatedCell value={row.original.patientName} maxWidthClassName="max-w-48" bold />
      </div>
    ),
  },
  {
    accessorKey: "patientPhone",
    header: "Telefon",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{formatTurkishPhoneDisplay(row.original.patientPhone)}</span>
    ),
  },
  {
    accessorKey: "staffName",
    header: "Sağlayıcı",
    cell: ({ row }) => <TruncatedCell value={row.original.staffName} maxWidthClassName="max-w-40" />,
  },
  {
    accessorKey: "reason",
    header: "Sebep",
    cell: ({ row }) => <TruncatedCell value={row.original.reason} maxWidthClassName="max-w-48" />,
  },
  {
    accessorKey: "status",
    header: "Durum",
    cell: ({ row }) => <AppointmentStatusBadge status={row.original.status} />,
  },
]

export { appointmentColumns }

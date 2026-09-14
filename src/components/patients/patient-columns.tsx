"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

import { TruncatedCell } from "@/components/shared/truncated-cell"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientListRow } from "@/lib/patients/queries"
import { getInitials } from "@/lib/utils"

/**
 * Project Phoenix — Hasta Listesi was the one screen untouched across three
 * redesign passes: still a bare 3-column table with `email`/`createdAt`
 * fetched by `getPatients` and silently discarded. Both surface here now —
 * no new query, just rendering data that was already on the wire. Phone and
 * email collapse into one "İletişim" cell (a 4th flat column would crowd
 * the row) instead of a wider table.
 */
const patientColumns: ColumnDef<PatientListRow>[] = [
  {
    accessorKey: "fullName",
    header: "Ad Soyad",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {getInitials(row.original.fullName)}
        </div>
        <TruncatedCell value={row.original.fullName} maxWidthClassName="max-w-52" bold />
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "İletişim",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-mono text-sm">{formatTurkishPhoneDisplay(row.original.phone)}</span>
        {row.original.email && (
          <span className="text-muted-foreground truncate text-xs">{row.original.email}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Kayıt Tarihi",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {format(new Date(row.original.createdAt), "d MMM yyyy", { locale: tr })}
      </span>
    ),
  },
]

export { patientColumns }

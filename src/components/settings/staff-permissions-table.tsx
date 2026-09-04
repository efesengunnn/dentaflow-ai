"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"
import { getInitials } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/staff/constants"
import { grantPermission, revokePermission } from "@/lib/permissions/actions"
import type { StaffPermissionRow } from "@/lib/permissions/queries"

function StaffPermissionsTable({ rows }: { rows: StaffPermissionRow[] }) {
  return (
    <div className="flex flex-col divide-y rounded-2xl border">
      {rows.map((row) => (
        <PermissionRow key={row.staffId} row={row} />
      ))}
    </div>
  )
}

function PermissionRow({ row }: { row: StaffPermissionRow }) {
  const [isPending, startTransition] = useTransition()
  const isOwner = row.role === "owner"

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = checked
        ? await grantPermission(row.staffId, "financial_access")
        : await revokePermission(row.staffId, "financial_access")
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {getInitials(row.staffName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.staffName}</p>
        <p className="text-muted-foreground text-xs">
          {ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] ?? row.role}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground hidden text-sm sm:inline">Finansal Erişim</span>
        <Switch
          checked={row.hasFinancialAccess}
          onCheckedChange={handleToggle}
          disabled={isPending || isOwner}
          aria-label={`${row.staffName} için finansal erişim`}
        />
      </div>
    </div>
  )
}

export { StaffPermissionsTable }

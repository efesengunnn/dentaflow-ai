"use client"

import { UserCheck, UserX } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { Button } from "@/components/ui/button"
import { deactivateStaffMember, reactivateStaffMember } from "@/lib/staff/actions"
import type { StaffMemberRow } from "@/lib/staff/queries"

/**
 * Deactivating blocks someone's login and needs a confirm step — reuses
 * `EntityDeleteDialog`'s confirm-then-call-action shape with non-destructive
 * copy/icon/tone, rather than a second dialog component. Reactivating is
 * low-risk (just restores access) and needs no confirmation.
 */
function StaffStatusAction({ staff }: { staff: StaffMemberRow }) {
  const [isPending, startTransition] = useTransition()

  if (staff.isActive) {
    return (
      <EntityDeleteDialog
        title="Personeli Pasifleştir"
        description={`${staff.fullName} artık sisteme giriş yapamayacak. Daha sonra tekrar aktifleştirebilirsiniz.`}
        onConfirm={() => deactivateStaffMember(staff.id)}
        triggerLabel="Pasifleştir"
        triggerIcon={UserX}
        triggerVariant="outline"
        confirmLabel="Pasifleştir"
        confirmingLabel="Pasifleştiriliyor..."
      />
    )
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateStaffMember(staff.id)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <Button variant="outline" loading={isPending} onClick={handleReactivate}>
      <UserCheck />
      Aktifleştir
    </Button>
  )
}

export { StaffStatusAction }

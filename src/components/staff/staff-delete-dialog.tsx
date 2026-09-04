"use client"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { deleteStaffMember } from "@/lib/staff/actions"

function StaffDeleteDialog({ staffId, staffName }: { staffId: string; staffName: string }) {
  return (
    <EntityDeleteDialog
      title={`${staffName} silinsin mi?`}
      description="Bu personel listeden kaldırılacak ve giriş yapamayacak. Geçmiş kayıtlardaki (randevu, hasta, tedavi) izleri korunur, kayıt kalıcı olarak silinmez."
      onConfirm={() => deleteStaffMember(staffId)}
    />
  )
}

export { StaffDeleteDialog }

"use client"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { softDeletePatient } from "@/lib/patients/actions"

function PatientDeleteDialog({ patientId, patientName }: { patientId: string; patientName: string }) {
  return (
    <EntityDeleteDialog
      title={`${patientName} silinsin mi?`}
      description="Bu hasta listeden kaldırılacak. Geçmiş kaydı korunur, kayıt kalıcı olarak silinmez."
      onConfirm={() => softDeletePatient(patientId)}
    />
  )
}

export { PatientDeleteDialog }

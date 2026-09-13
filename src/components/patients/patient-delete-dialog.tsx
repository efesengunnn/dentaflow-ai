"use client"

import type { VariantProps } from "class-variance-authority"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import type { buttonVariants } from "@/components/ui/button"
import { softDeletePatient } from "@/lib/patients/actions"

/**
 * Trigger styling is forwarded so the same dialog can present as the default
 * prominent "Sil" button or, on the patient header (Sprint 33), as a quiet
 * ghost icon — a destructive action shouldn't compete with the primary
 * actions for attention. The confirm step stays clearly destructive.
 */
function PatientDeleteDialog({
  patientId,
  patientName,
  triggerLabel,
  triggerIcon,
  triggerVariant,
  triggerSize,
  triggerClassName,
}: {
  patientId: string
  patientName: string
  triggerLabel?: string
  triggerIcon?: React.ComponentProps<typeof EntityDeleteDialog>["triggerIcon"]
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  triggerSize?: VariantProps<typeof buttonVariants>["size"]
  triggerClassName?: string
}) {
  return (
    <EntityDeleteDialog
      title={`${patientName} silinsin mi?`}
      description="Bu hasta listeden kaldırılacak. Geçmiş kaydı korunur, kayıt kalıcı olarak silinmez."
      onConfirm={() => softDeletePatient(patientId)}
      triggerLabel={triggerLabel}
      triggerIcon={triggerIcon}
      triggerVariant={triggerVariant}
      triggerSize={triggerSize}
      triggerClassName={triggerClassName}
      confirmVariant="destructive"
    />
  )
}

export { PatientDeleteDialog }

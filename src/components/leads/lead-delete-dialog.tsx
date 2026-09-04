"use client"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { softDeleteLead } from "@/lib/leads/actions"

function LeadDeleteDialog({ leadId, leadName }: { leadId: string; leadName: string }) {
  return (
    <EntityDeleteDialog
      title={`${leadName} silinsin mi?`}
      description="Bu kayıt listeden kaldırılacak. Aktivite geçmişi korunur, kayıt kalıcı olarak silinmez."
      onConfirm={() => softDeleteLead(leadId)}
    />
  )
}

export { LeadDeleteDialog }

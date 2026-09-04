"use client"

import { EntityImportDialog } from "@/components/shared/entity-import-dialog"
import { commitLeadImport, previewLeadImport } from "@/lib/leads/actions"
import { LEAD_STATUS_LABELS } from "@/lib/leads/constants"

function LeadImportDialog() {
  return (
    <EntityImportDialog
      templateHref="/leads/import-template"
      previewAction={previewLeadImport}
      commitAction={commitLeadImport}
      renderPreviewPrimary={(row) => row.fullName}
      renderPreviewDetail={(row) => LEAD_STATUS_LABELS[row.status]}
    />
  )
}

export { LeadImportDialog }

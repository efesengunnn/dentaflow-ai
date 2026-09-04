"use client"

import { EntityImportDialog } from "@/components/shared/entity-import-dialog"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { commitPatientImport, previewPatientImport } from "@/lib/patients/actions"

function PatientImportDialog() {
  return (
    <EntityImportDialog
      templateHref="/patients/import-template"
      previewAction={previewPatientImport}
      commitAction={commitPatientImport}
      renderPreviewPrimary={(row) => row.fullName}
      renderPreviewDetail={(row) => formatTurkishPhoneDisplay(row.phone)}
    />
  )
}

export { PatientImportDialog }

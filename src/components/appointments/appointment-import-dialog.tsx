"use client"

import { EntityImportDialog } from "@/components/shared/entity-import-dialog"
import { commitAppointmentImport, previewAppointmentImport } from "@/lib/appointments/actions"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"

function AppointmentImportDialog() {
  return (
    <EntityImportDialog
      templateHref="/appointments/import-template"
      previewAction={previewAppointmentImport}
      commitAction={commitAppointmentImport}
      renderPreviewPrimary={(row) => formatTurkishPhoneDisplay(row.patientPhone)}
      renderPreviewDetail={(row) => `${row.date} ${row.time} · ${row.staffName}`}
      successMessage={(result) =>
        result.failed
          ? `${result.imported} kayıt içe aktarıldı, ${result.failed} kayıt başarısız oldu.`
          : `${result.imported} kayıt içe aktarıldı.`
      }
    />
  )
}

export { AppointmentImportDialog }

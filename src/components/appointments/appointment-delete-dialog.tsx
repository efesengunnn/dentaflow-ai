"use client"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { softDeleteAppointment } from "@/lib/appointments/actions"

function AppointmentDeleteDialog({
  appointmentId,
  patientName,
}: {
  appointmentId: string
  patientName: string
}) {
  return (
    <EntityDeleteDialog
      title={`${patientName} için randevu silinsin mi?`}
      description="Bu randevu listeden kaldırılacak. Aktivite geçmişi korunur, kayıt kalıcı olarak silinmez. Hastanın randevuyu iptal etmesi durumunda bunun yerine durumu 'İptal Edildi' olarak güncellemeyi düşünün."
      onConfirm={() => softDeleteAppointment(appointmentId)}
    />
  )
}

export { AppointmentDeleteDialog }

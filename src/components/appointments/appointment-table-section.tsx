"use client"

import { CalendarDays } from "lucide-react"

import { EntityTableSection } from "@/components/shared/entity-table-section"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { AppointmentCard } from "./appointment-card"
import { appointmentColumns } from "./appointment-columns"

type AppointmentTableSectionProps = {
  rows: AppointmentListRow[]
  total: number
  page: number
  pageSize: number
}

function AppointmentTableSection({ rows, total, page, pageSize }: AppointmentTableSectionProps) {
  return (
    <EntityTableSection
      columns={appointmentColumns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      getRowHref={(appointment) => `/patients/${appointment.patientId}`}
      renderCard={(appointment) => <AppointmentCard appointment={appointment} />}
      emptyIcon={CalendarDays}
      emptyTitle="Henüz randevu yok"
      emptyDescription="İlk randevunuzu oluşturduğunuzda burada listelenmeye başlayacak."
    />
  )
}

export { AppointmentTableSection }

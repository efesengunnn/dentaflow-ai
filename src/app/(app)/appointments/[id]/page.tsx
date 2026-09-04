import { notFound } from "next/navigation"

import { AppointmentDetailView } from "@/components/appointments/appointment-detail-view"
import { getAppointmentActivities, getAppointmentById } from "@/lib/appointments/queries"
import { getPatientOptions } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"

type AppointmentDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
  const { id } = await params

  const [appointment, activities, patientOptions, staffOptions] = await Promise.all([
    getAppointmentById(id),
    getAppointmentActivities(id),
    getPatientOptions(),
    getAssignableStaff(),
  ])

  if (!appointment) {
    notFound()
  }

  return (
    <AppointmentDetailView
      appointment={appointment}
      activities={activities}
      patientOptions={patientOptions}
      staffOptions={staffOptions}
    />
  )
}

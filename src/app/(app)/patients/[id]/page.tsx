import { notFound } from "next/navigation"

import { PatientDetailView } from "@/components/patients/patient-detail-view"
import { getAppointmentsForPatient } from "@/lib/appointments/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatientActivities, getPatientById, getPatientOptions } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"

type PatientDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ randevuHata?: string }>
}

export default async function PatientDetailPage({ params, searchParams }: PatientDetailPageProps) {
  const { id } = await params
  const { randevuHata } = await searchParams

  const [patient, staffMember, activities, appointments, staffOptions, patientOptions] = await Promise.all([
    getPatientById(id),
    getCurrentStaffMember(),
    getPatientActivities(id),
    getAppointmentsForPatient(id),
    getAssignableStaff(),
    getPatientOptions(),
  ])

  if (!patient) {
    notFound()
  }

  const canManage = staffMember?.role !== "doctor"

  return (
    <PatientDetailView
      patient={patient}
      activities={activities}
      appointments={appointments}
      staffOptions={staffOptions}
      patientOptions={patientOptions}
      canManage={canManage}
      appointmentError={randevuHata}
    />
  )
}

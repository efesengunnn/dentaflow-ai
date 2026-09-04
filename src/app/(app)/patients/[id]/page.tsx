import { notFound } from "next/navigation"

import { PatientDetailView } from "@/components/patients/patient-detail-view"
import { getAppointmentsForPatient } from "@/lib/appointments/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatientBalance, getPatientPayments } from "@/lib/payments/queries"
import { getPatientActivities, getPatientById, getPatientOptions } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"
import { getToothConditionsForPatient, getToothTreatmentsForPatient } from "@/lib/teeth/queries"
import { getTreatmentCatalog } from "@/lib/treatment-catalog/queries"

type PatientDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ randevuHata?: string }>
}

export default async function PatientDetailPage({ params, searchParams }: PatientDetailPageProps) {
  const { id } = await params
  const { randevuHata } = await searchParams

  const [
    patient,
    staffMember,
    activities,
    appointments,
    staffOptions,
    patientOptions,
    toothConditions,
    toothTreatments,
    catalog,
    balance,
    payments,
  ] = await Promise.all([
    getPatientById(id),
    getCurrentStaffMember(),
    getPatientActivities(id),
    getAppointmentsForPatient(id),
    getAssignableStaff(),
    getPatientOptions(),
    getToothConditionsForPatient(id),
    getToothTreatmentsForPatient(id),
    getTreatmentCatalog(),
    getPatientBalance(id),
    getPatientPayments(id),
  ])

  if (!patient) {
    notFound()
  }

  const canManage = staffMember?.role !== "doctor"
  const canManagePayments = staffMember?.role === "owner" || staffMember?.role === "secretary"
  const canManageClinical = staffMember?.role === "owner" || staffMember?.role === "doctor"

  return (
    <PatientDetailView
      patient={patient}
      activities={activities}
      appointments={appointments}
      staffOptions={staffOptions}
      patientOptions={patientOptions}
      canManage={canManage}
      appointmentError={randevuHata}
      toothConditions={toothConditions}
      toothTreatments={toothTreatments}
      catalog={catalog}
      balance={balance}
      payments={payments}
      canManagePayments={canManagePayments}
      canManageClinical={canManageClinical}
    />
  )
}

import { notFound } from "next/navigation"

import { PatientDetailView } from "@/components/patients/patient-detail-view"
import { getPatientSummaryForAI } from "@/lib/ai/queries"
import { getAppointmentsForPatient } from "@/lib/appointments/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatientDocuments } from "@/lib/documents/queries"
import { getPatientActivities, getPatientById, getPatientOptions } from "@/lib/patients/queries"
import { currentStaffHasPermission } from "@/lib/permissions/queries"
import { getAssignableStaff } from "@/lib/staff/queries"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import { getPatientTreatmentPlans } from "@/lib/treatment-plans/queries"
import { getTreatmentSeriesForPatientWithDetails } from "@/lib/treatments/queries"

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
    treatmentSeries,
    treatmentPlans,
    documents,
    hasFinancialAccess,
  ] = await Promise.all([
    getPatientById(id),
    getCurrentStaffMember(),
    getPatientActivities(id),
    getAppointmentsForPatient(id),
    getAssignableStaff(),
    getPatientOptions(),
    getTreatmentSeriesForPatientWithDetails(id),
    getPatientTreatmentPlans(id),
    getPatientDocuments(id),
    currentStaffHasPermission("financial_access"),
  ])

  if (!patient) {
    notFound()
  }

  const aiSummary = await getPatientSummaryForAI(id, hasFinancialAccess)

  const canManage = staffMember?.role !== "doctor"
  const canManagePayments =
    staffMember?.role === "owner" || staffMember?.role === "secretary" || staffMember?.role === "beauty_specialist"
  // Sprint 28B (Tedavi Planı wizard, UI-only) — provider_share is owner-only,
  // not even the provider themself; see TreatmentPlanItemCard.
  const isOwner = staffMember?.role === "owner"
  // Sprint 28C.1 (Flexible Delete & Audit) — passed down for UI affordance
  // gating only (see lib/treatment-plans/permissions.ts's own doc comment);
  // RLS + the Server Actions remain the actual security boundary. Falls back
  // to the least-privileged clinical role when there's no session, matching
  // the rest of this page's `staffMember?.role` guards.
  const treatmentPlanActor: TreatmentPlanActor = {
    staffId: staffMember?.userId ?? "",
    role: staffMember?.role ?? "secretary",
    hasFinancialAccess,
  }

  return (
    <PatientDetailView
      patient={patient}
      activities={activities}
      appointments={appointments}
      staffOptions={staffOptions}
      patientOptions={patientOptions}
      canManage={canManage}
      clinicId={staffMember?.clinicId ?? ""}
      documents={documents}
      treatmentSeries={treatmentSeries}
      canManagePayments={canManagePayments}
      isOwner={isOwner}
      treatmentPlanActor={treatmentPlanActor}
      treatmentPlans={treatmentPlans}
      appointmentError={randevuHata}
      aiSummary={aiSummary}
    />
  )
}

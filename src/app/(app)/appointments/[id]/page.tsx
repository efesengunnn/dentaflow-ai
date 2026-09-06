import { notFound } from "next/navigation"

import { AppointmentDetailView } from "@/components/appointments/appointment-detail-view"
import { AppointmentErrorToast } from "@/components/patients/appointment-error-toast"
import { getAppointmentActivities, getAppointmentById } from "@/lib/appointments/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatientOptions } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import { getAppointmentLinkedTreatmentPlanItem } from "@/lib/treatment-plans/queries"
import { getTreatmentSeriesDetail } from "@/lib/treatments/queries"

type AppointmentDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tedaviHata?: string }>
}

export default async function AppointmentDetailPage({ params, searchParams }: AppointmentDetailPageProps) {
  const { id } = await params
  const { tedaviHata } = await searchParams

  const [appointment, activities, patientOptions, staffOptions, staffMember] = await Promise.all([
    getAppointmentById(id),
    getAppointmentActivities(id),
    getPatientOptions(),
    getAssignableStaff(),
    getCurrentStaffMember(),
  ])

  if (!appointment) {
    notFound()
  }

  // Treatment content is clinical (owner/doctor/beauty_specialist write it);
  // payments are a front-desk responsibility (owner/secretary) — same split
  // as Patient Detail's "Hızlı İşlemler" (Sprint 17), reused here for
  // Sprint 18's appointment-level quick actions.
  const canManageTreatments = staffMember?.role !== "secretary"
  const canManagePayments =
    staffMember?.role === "owner" || staffMember?.role === "secretary" || staffMember?.role === "beauty_specialist"
  const seriesDetail = appointment.linkedTreatment
    ? await getTreatmentSeriesDetail(appointment.linkedTreatment.seriesId)
    : null
  // Sprint 28D — the new-model sibling of `seriesDetail` above. An
  // appointment has at most one of the two links (legacy series or new plan
  // item), never both, but both are fetched unconditionally since
  // `appointment.linkedTreatment` only ever reflects the legacy join.
  const linkedTreatmentPlanItem = await getAppointmentLinkedTreatmentPlanItem(appointment.id)
  // Sprint 28D — UI affordance gating for "Seansı Tamamla" only (RLS + the
  // Server Action remain the actual security boundary); falls back to the
  // least-privileged clinical role when there's no session, same convention
  // as Patient Detail's own `treatmentPlanActor`.
  const treatmentPlanActor: TreatmentPlanActor = {
    staffId: staffMember?.userId ?? "",
    role: staffMember?.role ?? "secretary",
    hasFinancialAccess: false,
  }

  return (
    <>
      <AppointmentErrorToast message={tedaviHata} />
      <AppointmentDetailView
        appointment={appointment}
        activities={activities}
        patientOptions={patientOptions}
        staffOptions={staffOptions}
        seriesDetail={seriesDetail}
        linkedTreatmentPlanItem={linkedTreatmentPlanItem}
        treatmentPlanActor={treatmentPlanActor}
        canManageTreatments={canManageTreatments}
        canManagePayments={canManagePayments}
      />
    </>
  )
}

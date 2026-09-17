import { notFound } from "next/navigation"

import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatientById } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"
import { TreatmentPlanBuilderPage } from "@/components/treatment-plans/treatment-plan-builder-page"

type NewTreatmentPlanPageProps = {
  params: Promise<{ id: string }>
}

/**
 * "Tedavi Planı Ekle" — Hasta Kartı'nın "Aktif Tedavi Planı" bölümündeki ana
 * giriş noktası, Sprint 30 follow-up (founder feedback 2026-08-11): tam
 * sayfa navigasyonu, Sheet değil — "Randevu Oluştur" akışının aksine, aktif
 * plan olsa da olmasa da her zaman erişilebilir (bir hastaya sonradan ikinci
 * bir paket satılması gibi gerçek bir senaryoyu karşılar).
 */
export default async function NewTreatmentPlanPage({ params }: NewTreatmentPlanPageProps) {
  const { id } = await params

  const [patient, staffMember, staffOptions] = await Promise.all([
    getPatientById(id),
    getCurrentStaffMember(),
    getAssignableStaff(),
  ])

  if (!patient) {
    notFound()
  }

  const isOwner = staffMember?.role === "owner"

  return (
    <PageContainer size="narrow">
      <BreadcrumbLabel value={patient.fullName} />
      <PageHeader title="Tedavi Planı Oluştur" description={`${patient.fullName} için yeni bir tedavi planı oluşturun.`} />
      <TreatmentPlanBuilderPage
        patientId={patient.id}
        patientBirthDate={patient.dateOfBirth}
        staffOptions={staffOptions}
        isOwner={isOwner}
      />
    </PageContainer>
  )
}

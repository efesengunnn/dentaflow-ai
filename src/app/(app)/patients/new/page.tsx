import { redirect } from "next/navigation"

import { NewPatientForm } from "@/components/patients/new-patient-form"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getAssignableStaff } from "@/lib/staff/queries"

export default async function NewPatientPage() {
  const [staffMember, staffOptions] = await Promise.all([
    getCurrentStaffMember(),
    getAssignableStaff(),
  ])
  if (staffMember?.role === "doctor") {
    redirect("/patients")
  }

  return (
    <PageContainer size="narrow">
      <PageHeader title="Yeni Hasta" description="Yeni bir hasta kaydı oluşturun." />
      <NewPatientForm staffOptions={staffOptions} />
    </PageContainer>
  )
}

import { redirect } from "next/navigation"

import { NewLeadForm } from "@/components/leads/new-lead-form"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getAssignableStaff } from "@/lib/staff/queries"

export default async function NewLeadPage() {
  const [staffMember, staffOptions] = await Promise.all([
    getCurrentStaffMember(),
    getAssignableStaff(),
  ])
  if (staffMember?.role === "doctor") {
    redirect("/leads")
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Yeni Potansiyel Müşteri"
        description="Yeni bir potansiyel müşteri kaydı oluşturun."
      />
      <NewLeadForm staffOptions={staffOptions} />
    </PageContainer>
  )
}

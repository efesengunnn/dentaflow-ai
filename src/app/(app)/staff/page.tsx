import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { StaffInviteSheet } from "@/components/staff/staff-invite-sheet"
import { StaffListSection } from "@/components/staff/staff-list-section"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getStaffMembersForClinic } from "@/lib/staff/queries"

export default async function StaffPage() {
  const staffMember = await getCurrentStaffMember()
  const canManage = staffMember?.role === "owner"
  const rows = await getStaffMembersForClinic()

  return (
    <PageContainer>
      <PageHeader
        title="Personel"
        description="Klinik ekibinizi ve rollerini buradan yönetin."
        actions={canManage ? <StaffInviteSheet /> : undefined}
      />
      <StaffListSection rows={rows} canManage={canManage} />
    </PageContainer>
  )
}

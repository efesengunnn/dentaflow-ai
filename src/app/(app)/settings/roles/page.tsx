import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StaffPermissionsTable } from "@/components/settings/staff-permissions-table"
import { Users } from "lucide-react"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getStaffPermissionsForClinic } from "@/lib/permissions/queries"

export default async function RolesSettingsPage() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  if (staffMember.role !== "owner") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Roller" description="Owner, Doktor, Sekreter ve Güzellik Uzmanı rollerinin yetkilerini görüntüleyin." />
        <p className="text-muted-foreground text-sm">Bu sayfayı yalnızca klinik sahibi kullanabilir.</p>
      </div>
    )
  }

  const rows = await getStaffPermissionsForClinic()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roller"
        description="Finansal verilere kimlerin erişebileceğini yönetin. Klinik sahibi her zaman erişebilir."
      />
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Henüz personel yok" description="Personel eklediğinizde burada listelenecek." />
      ) : (
        <StaffPermissionsTable rows={rows} />
      )}
    </div>
  )
}

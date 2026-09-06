import { PageHeader } from "@/components/shared/page-header"
import { TreatmentCatalogSection } from "@/components/settings/treatment-catalog-section"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getAssignableStaff } from "@/lib/staff/queries"
import { getCatalogForClinic } from "@/lib/treatment-catalog/queries"

export default async function TreatmentCatalogSettingsPage() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  if (staffMember.role !== "owner") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Tedavi Kataloğu"
          description="Her personelin sunduğu tedavileri ve önerilen fiyatları yönetin."
        />
        <p className="text-muted-foreground text-sm">Bu sayfayı yalnızca klinik sahibi kullanabilir.</p>
      </div>
    )
  }

  const [staffOptions, items] = await Promise.all([getAssignableStaff(), getCatalogForClinic()])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tedavi Kataloğu"
        description="Her personelin sunduğu tedavileri ve önerilen fiyatları yönetin. Randevu oluştururken bu liste personel seçimine göre önerilir."
      />
      <div className="flex flex-col gap-4">
        {staffOptions.map((staff) => (
          <TreatmentCatalogSection
            key={staff.id}
            staffId={staff.id}
            staffName={staff.fullName}
            items={items.filter((item) => item.staffId === staff.id)}
          />
        ))}
      </div>
    </div>
  )
}

import { PageHeader } from "@/components/shared/page-header"
import { TreatmentCatalogSection } from "@/components/settings/treatment-catalog-section"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getTreatmentCatalog } from "@/lib/treatment-catalog/queries"

export default async function TreatmentsSettingsPage() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  if (staffMember.role !== "owner") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Tedavi Kataloğu" description="Klinik fiyat listenizi buradan yönetin." />
        <p className="text-muted-foreground text-sm">Bu sayfayı yalnızca klinik sahibi kullanabilir.</p>
      </div>
    )
  }

  const items = await getTreatmentCatalog(true)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tedavi Kataloğu"
        description="Diş tedavisi eklerken seçilebilecek işlemleri ve standart ücretlerini tanımlayın."
      />
      <TreatmentCatalogSection items={items} />
    </div>
  )
}

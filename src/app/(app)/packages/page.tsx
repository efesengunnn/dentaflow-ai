import { PackageFilters } from "@/components/packages/package-filters"
import { PackageTableSection } from "@/components/packages/package-table-section"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import type { TreatmentLifecycleStatus } from "@/lib/treatment-plans/constants"
import { getAllTreatmentPlans } from "@/lib/treatment-plans/queries"

type PackagesPageProps = {
  searchParams: Promise<{ status?: string }>
}

/**
 * Owner-only "Paketler" — Sprint 30.3, madde G. Klinik genelinde satılmış
 * her paketi tek ekranda listeler; mevcut `treatment_plans`/
 * `treatment_plan_items` tablolarını okur, yeni tablo yok. Sekreter ve diğer
 * roller bu sayfayı görmez (nav'da `restrictedTo: ["owner"]`); doğrudan URL
 * ile gelen bir sekreterin de sunucu tarafında engellenmesi için
 * `getAllTreatmentPlans` zaten `null` döner — o durumda burada da kısa bir
 * "yetkiniz yok" mesajı gösterilir (Roller/Tedavi Kataloğu ekranlarındaki
 * aynı desen).
 */
export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const params = await searchParams
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  if (staffMember.role !== "owner") {
    return (
      <PageContainer>
        <PageHeader title="Paketler" description="Klinikte satılmış her paketin tek listesi." />
        <p className="text-sm text-muted-foreground">Bu sayfayı yalnızca klinik sahibi kullanabilir.</p>
      </PageContainer>
    )
  }

  const rows = (await getAllTreatmentPlans({ status: params.status as TreatmentLifecycleStatus | undefined })) ?? []

  return (
    <PageContainer>
      <PageHeader title="Paketler" description="Klinikte satılmış her paketin tek listesi." />
      <PackageFilters />
      <PackageTableSection rows={rows} />
    </PageContainer>
  )
}

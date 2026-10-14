import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { notFound } from "next/navigation"

import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { PackagePrintButton } from "@/components/packages/package-print-button"
import { InfoGrid } from "@/components/shared/info-grid"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { Separator } from "@/components/ui/separator"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getPatientById } from "@/lib/patients/queries"
import { formatToothList } from "@/lib/odontogram/fdi"
import { deriveItemProgress } from "@/lib/treatment-plans/constants"
import { getTreatmentPlanDetail, type TreatmentPlanItemDetail } from "@/lib/treatment-plans/queries"
import { TreatmentPlanProgressBadge } from "@/components/treatment-plans/treatment-plan-status-badge"
import { TreatmentProgressBadge } from "@/components/treatment-plans/treatment-progress-badge"

type PackageDetailPageProps = {
  params: Promise<{ id: string }>
}

function formatMoney(amount: number | null): string {
  return amount === null ? "Belirlenmedi" : `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

function formatDate(value: string): string {
  return format(new Date(value), "d MMMM yyyy", { locale: tr })
}

/**
 * Owner-only "Paket Detay" — Sprint 30.3, madde G. `getTreatmentPlanDetail`
 * (Sprint 28'den beri var, hasta kartındaki Sheet'in de kullandığı sorgu)
 * aynen yeniden kullanılır — yeni sorgu yok. Sheet yerine tam sayfa: hem
 * founder'ın "ana işlemler tam sayfa" kararıyla tutarlı, hem de "Yazdır"ın
 * (madde G) düzgün çalışması için bir Sheet'ten daha uygun.
 */
export default async function PackageDetailPage({ params }: PackageDetailPageProps) {
  const { id } = await params
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  if (staffMember.role !== "owner") {
    return (
      <PageContainer size="narrow">
        <PageHeader title="Paket Detay" description="Bu sayfayı yalnızca klinik sahibi kullanabilir." />
      </PageContainer>
    )
  }

  const plan = await getTreatmentPlanDetail(id)
  if (!plan) notFound()

  const patient = await getPatientById(plan.patientId)
  if (!patient) notFound()

  const itemsByProvider = new Map<string, TreatmentPlanItemDetail[]>()
  for (const item of plan.items) {
    const list = itemsByProvider.get(item.providerId) ?? []
    list.push(item)
    itemsByProvider.set(item.providerId, list)
  }

  return (
    <PageContainer size="narrow">
      <BreadcrumbLabel value={plan.planName} />
      <PageHeader
        title={plan.planName}
        description={`${patient.fullName} — ${formatDate(plan.createdAt)} tarihinde oluşturuldu.`}
        actions={<PackagePrintButton />}
      />

      <div className="flex items-center gap-2">
        <TreatmentPlanProgressBadge plan={plan} />
      </div>

      <div className="flex flex-col gap-6">
        {Array.from(itemsByProvider.entries()).map(([providerId, providerItems]) => {
          const subtotal = providerItems.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
          return (
            <div key={providerId} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <p className="font-semibold">{providerItems[0]?.providerName ?? "Hekim"}</p>
              <div className="flex flex-col gap-3">
                {providerItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5 border-t pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                        {item.treatmentName}
                        <TreatmentProgressBadge progress={deriveItemProgress(item)} />
                      </span>
                      <span className="font-medium tabular-nums">{formatMoney(item.totalPrice)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Birim fiyat: {formatMoney(item.unitPrice)}</span>
                      {item.toothNumbers.length > 0 && (
                        <span className="tabular-nums">Dişler: {formatToothList(item.toothNumbers)}</span>
                      )}
                      {item.controlDate && <span>Kontrol Günü: {formatDate(item.controlDate)}</span>}
                    </div>
                    {item.completions.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5 pl-3 text-xs text-muted-foreground">
                        {item.completions.map((completion) => (
                          <div key={completion.sessionId} className="flex items-center justify-between gap-3">
                            <span className="tabular-nums">
                              {completion.toothNumbers.length > 0 ? `Diş ${formatToothList(completion.toothNumbers)}` : "Tedavi"}
                            </span>
                            <span>{formatDate(completion.performedAt)} tamamlandı</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">Ara Toplam</span>
                <span className="font-medium tabular-nums">{formatMoney(subtotal)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <Separator />

      <InfoGrid
        items={[
          { label: "Toplam", value: formatMoney(plan.totalAmount) },
          { label: "Ödenen", value: formatMoney(plan.paidAmount) },
          { label: "Kalan", value: formatMoney(plan.remainingBalance) },
        ]}
      />

      <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3.5">
        <span className="font-medium">Genel Toplam</span>
        <span className="font-display text-lg font-semibold tabular-nums">{formatMoney(plan.totalAmount)}</span>
      </div>
    </PageContainer>
  )
}

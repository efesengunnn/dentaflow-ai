"use client"

import { Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { InfoGrid } from "@/components/shared/info-grid"
import { InlineWarningBanner } from "@/components/shared/inline-warning-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { TreatmentSeriesDetail } from "@/lib/treatments/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { AddPaymentSheet } from "./add-payment-sheet"
import { TreatmentSeriesDetailSheet } from "./treatment-series-detail-sheet"
import { TreatmentStatusBadge } from "./treatment-status-badge"

function formatMoney(amount: number | null, currency: string): string {
  return amount === null ? "Belirlenmedi" : `${amount.toLocaleString("tr-TR")} ${currency}`
}

function TreatmentSeriesCard({
  series,
  staffOptions,
  canManageTreatments,
  canManagePayments,
  canCorrectPayments,
}: {
  series: TreatmentSeriesDetail
  staffOptions: AssignableStaff[]
  canManageTreatments: boolean
  canManagePayments: boolean
  canCorrectPayments: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const progressPercent =
    series.totalSessions > 0 ? Math.min((series.completedSessions / series.totalSessions) * 100, 100) : 0
  const hasBalanceDue = series.remainingBalance !== null && series.remainingBalance > 0

  return (
    <>
      <Card
        size="sm"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setOpen(true)
        }}
        className="cursor-pointer transition-colors duration-150 hover:bg-muted/40"
      >
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center gap-x-4 gap-y-1">
            <span className="min-w-0 flex-1 truncate font-medium">{series.treatmentType}</span>
            <TreatmentStatusBadge status={series.status} />
          </div>
          {/* Sprint 17 — açık metin önce, ince progress bar altında; sayı
              tek başına ("3/8") yerine ne olduğu söylensin. Bakiye durumu
              artık aşağıdaki finans gridinde ayrıca gösterildiği için burada
              tekrar edilmiyor. */}
          <span className="text-sm text-muted-foreground">
            {series.completedSessions} / {series.totalSessions} Seans Tamamlandı
          </span>
          <Progress value={progressPercent} className="h-1.5" />

          {/* Sprint 16 — Ücret/Tahsil Edilen/Kalan tek bakışta, detay Sheet'ini açmadan. */}
          <InfoGrid
            compact
            items={[
              { label: "Ücret", value: formatMoney(series.totalFee, series.currency) },
              { label: "Tahsil Edilen", value: formatMoney(series.paidAmount, series.currency) },
              { label: "Kalan", value: formatMoney(series.remainingBalance, series.currency) },
            ]}
          />

          {hasBalanceDue && canManagePayments && (
            <InlineWarningBanner
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              message="Kalan ödeme bulunmaktadır."
              action={
                <AddPaymentSheet
                  seriesId={series.id}
                  remainingBalance={series.remainingBalance}
                  title="Tahsilat Yap"
                  description={`${series.treatmentType} paketi için tahsilat kaydedin.`}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Wallet />
                      Tahsilat Yap
                    </Button>
                  }
                  onSuccess={() => router.refresh()}
                />
              }
            />
          )}
        </CardContent>
      </Card>

      <TreatmentSeriesDetailSheet
        series={series}
        staffOptions={staffOptions}
        canManageTreatments={canManageTreatments}
        canManagePayments={canManagePayments}
        canCorrectPayments={canCorrectPayments}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

export { TreatmentSeriesCard }

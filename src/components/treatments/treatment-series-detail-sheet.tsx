"use client"

import { CheckCircle2, Circle, CreditCard, History } from "lucide-react"
import { useRouter } from "next/navigation"

import { EmptyState } from "@/components/shared/empty-state"
import { InfoGrid } from "@/components/shared/info-grid"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { TREATMENT_ACTIVITY_LABELS, TREATMENT_PAYMENT_METHOD_LABELS } from "@/lib/treatments/constants"
import type { TreatmentSeriesDetail } from "@/lib/treatments/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { AddPaymentSheet } from "./add-payment-sheet"
import { AddSessionSheet } from "./add-session-sheet"
import { CompleteSessionButton } from "./complete-session-button"
import { EditSeriesSheet } from "./edit-series-sheet"
import { PaymentCorrectionSheet } from "./payment-correction-sheet"
import { TreatmentStatusBadge } from "./treatment-status-badge"

/** `null` renders as "Belirlenmedi" — never a fake "0,00 TRY" (Sprint 8). */
function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null) return "Belirlenmedi"
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function TreatmentSeriesDetailSheet({
  series,
  staffOptions,
  canManageTreatments,
  canManagePayments,
  canCorrectPayments,
  open,
  onOpenChange,
  onDataChanged,
}: {
  series: TreatmentSeriesDetail
  staffOptions: AssignableStaff[]
  canManageTreatments: boolean
  canManagePayments: boolean
  canCorrectPayments: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional extra hook alongside `router.refresh()` — the Dashboard's on-demand usage (Founder decision 2026-07-28) holds its own client-fetched `series` copy that a router refresh alone won't update. */
  onDataChanged?: () => void
}) {
  const router = useRouter()

  function refresh() {
    router.refresh()
    onDataChanged?.()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {series.treatmentType}
            <TreatmentStatusBadge status={series.status} />
            {canManageTreatments && (
              <EditSeriesSheet
                seriesId={series.id}
                treatmentType={series.treatmentType}
                totalSessions={series.totalSessions}
                totalFee={series.totalFee}
                onSuccess={refresh}
              />
            )}
          </SheetTitle>
          <SheetDescription>
            {series.completedSessions}/{series.totalSessions} seans tamamlandı · Kalan{" "}
            {series.remainingSessions} seans
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <InfoGrid
            items={[
              { label: "Ücret", value: formatCurrency(series.totalFee, series.currency) },
              { label: "Ödenen", value: formatCurrency(series.paidAmount, series.currency) },
              { label: "Kalan Bakiye", value: formatCurrency(series.remainingBalance, series.currency) },
            ]}
          />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Seanslar</h3>
              {canManageTreatments && series.status === "active" && series.remainingSessions > 0 ? (
                <AddSessionSheet
                  seriesId={series.id}
                  suggestedSessionNumber={series.completedSessions + 1}
                  staffOptions={staffOptions}
                  onSuccess={refresh}
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: series.totalSessions }, (_, index) => index + 1).map((sessionNumber) => {
                const session = series.sessions.find(
                  (row) => row.sessionNumber === sessionNumber && row.status !== "voided",
                )
                const isCompleted = session?.status === "completed"
                const canComplete = !isCompleted && canManageTreatments && series.status === "active"

                return (
                  <Card key={sessionNumber} size="sm">
                    <CardContent className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {isCompleted ? (
                          <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                        ) : (
                          <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className={cn("font-medium", !isCompleted && "text-muted-foreground")}>
                            {sessionNumber}. Seans
                          </span>
                          {session && (
                            <p className="text-muted-foreground">
                              {new Date(session.treatmentDate).toLocaleDateString("tr-TR")} · {session.staffName}
                            </p>
                          )}
                          {session?.description ? <p className="mt-1">{session.description}</p> : null}
                          {session?.controlDate ? (
                            <p className="mt-1 text-muted-foreground">
                              Kontrol: {new Date(session.controlDate).toLocaleDateString("tr-TR")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {canComplete && <CompleteSessionButton seriesId={series.id} sessionNumber={sessionNumber} />}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Ödemeler</h3>
              {canManagePayments ? (
                <AddPaymentSheet
                  seriesId={series.id}
                  remainingBalance={series.remainingBalance}
                  onSuccess={refresh}
                />
              ) : null}
            </div>
            {series.payments.length === 0 ? (
              <EmptyState compact icon={CreditCard} title="Henüz ödeme kaydı yok" />
            ) : (
              <div className="flex flex-col gap-2">
                {series.payments.map((payment) => (
                  <Card key={payment.id} size="sm">
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(payment.amount, payment.currency)}</span>
                          {payment.entryType !== "payment" ? (
                            <Badge variant="warning">{TREATMENT_PAYMENT_METHOD_LABELS[payment.method]}</Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">
                          {new Date(payment.paidAt).toLocaleDateString("tr-TR")} ·{" "}
                          {TREATMENT_PAYMENT_METHOD_LABELS[payment.method]}
                          {payment.recordedByName ? ` · ${payment.recordedByName}` : ""}
                        </p>
                      </div>
                      {canCorrectPayments && payment.entryType === "payment" ? (
                        <PaymentCorrectionSheet seriesId={series.id} payment={payment} onSuccess={refresh} />
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Geçmiş</h3>
            {series.activities.length === 0 ? (
              <EmptyState compact icon={History} title="Henüz geçmiş yok" />
            ) : (
              <div className="flex flex-col gap-2">
                {series.activities.map((activity) => (
                  <div key={activity.id} className="text-sm">
                    <p>{activity.description || TREATMENT_ACTIVITY_LABELS[activity.activityType]}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.authorName ?? "Sistem"} ·{" "}
                      {new Date(activity.createdAt).toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { TreatmentSeriesDetailSheet }

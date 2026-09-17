import { CheckCircle2, Pencil, Stethoscope, UserRound, Wallet } from "lucide-react"
import Link from "next/link"

import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { InlineWarningBanner } from "@/components/shared/inline-warning-banner"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { PageSection } from "@/components/shared/page-section"
import { CompleteSessionSheet } from "@/components/treatment-plans/complete-session-sheet"
import { AddPaymentSheet } from "@/components/treatments/add-payment-sheet"
import { CompleteSessionButton } from "@/components/treatments/complete-session-button"
import { TreatmentEntrySheet } from "@/components/treatments/treatment-entry-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AppointmentActivityRow, AppointmentDetail } from "@/lib/appointments/queries"
import { formatCurrency } from "@/lib/format/currency"
import { formatIstanbulDateTime } from "@/lib/format/date"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { canCompleteSession, type TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { AppointmentLinkedTreatmentPlanItem } from "@/lib/treatment-plans/queries"
import type { TreatmentSeriesDetail } from "@/lib/treatments/queries"
import { cn } from "@/lib/utils"
import { AppointmentActivityTimeline } from "./appointment-activity-timeline"
import { AppointmentDeleteDialog } from "./appointment-delete-dialog"
import { AppointmentEditSheet } from "./appointment-edit-sheet"
import { AppointmentInfoPanel } from "./appointment-info-panel"
import { AppointmentPlanPaymentButton } from "./appointment-plan-payment-button"

/**
 * Every role (owner/doctor/secretary) can manage appointments — unlike Lead/
 * Patient Detail, there is no `canManage` gate here at all (see
 * docs/DATABASE.md's appointments RLS row: INSERT/UPDATE is open to all
 * roles, a deliberate difference from Leads/Patients' owner/secretary-only
 * write access). Sprint 18's `canManageTreatments`/`canManagePayments` only
 * gate the new "Hızlı İşlemler" buttons — the existing Edit/Delete actions
 * above stay ungated, unchanged.
 */
function AppointmentDetailView({
  appointment,
  activities,
  patientOptions,
  staffOptions,
  seriesDetail,
  linkedTreatmentPlanItems,
  treatmentPlanActor,
  canManageTreatments,
  canManagePayments,
}: {
  appointment: AppointmentDetail
  activities: AppointmentActivityRow[]
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
  /** The full series behind `appointment.linkedTreatment`, only fetched when one exists — feeds the quick actions below. */
  seriesDetail: TreatmentSeriesDetail | null
  /** Sprint 34 — the new-model treatments this appointment covers (one visit can include several). Legacy series live separately in `seriesDetail`. */
  linkedTreatmentPlanItems: AppointmentLinkedTreatmentPlanItem[]
  treatmentPlanActor: TreatmentPlanActor
  canManageTreatments: boolean
  canManagePayments: boolean
}) {
  const linkedTreatment = appointment.linkedTreatment
  const linkedSession =
    linkedTreatment && seriesDetail
      ? seriesDetail.sessions.find((session) => session.sessionNumber === linkedTreatment.sessionNumber)
      : null
  const linkedSessionIncomplete = linkedTreatment !== null && linkedSession?.status !== "completed"
  const seriesActive = seriesDetail?.status === "active"

  // Same underlying condition (an incomplete session tied to this specific
  // appointment), mutually exclusive by `appointment.status`: while the
  // appointment itself is still open it's a quick action inside "Hızlı
  // İşlemler"; once completed it becomes the standalone suggestion banner
  // below — never both, never a second "complete session" control.
  const showCompleteSessionAction = appointment.status !== "completed" && linkedSessionIncomplete && seriesActive
  const showCompletionSuggestion = appointment.status === "completed" && linkedSessionIncomplete && seriesActive

  const showTedaviBaslat = !linkedTreatment && linkedTreatmentPlanItems.length === 0 && canManageTreatments
  const showTahsilatYap =
    seriesDetail !== null && canManagePayments && seriesDetail.remainingBalance !== null && seriesDetail.remainingBalance > 0

  // Sprint 34 — an appointment can cover several plan items. Each eligible item
  // gets its own "Seansı Tamamla"; `canCompleteEach` mirrors the same
  // idempotency check `completeTreatmentSession` re-verifies server-side.
  const canCompleteSessions = canCompleteSession(treatmentPlanActor) && appointment.status !== "completed"
  const completableItems = canCompleteSessions
    ? linkedTreatmentPlanItems.filter(
        (item) => !item.hasCompletedSessionForAppointment && item.remainingSessions > 0 && item.itemStatus === "active",
      )
    : []

  // Payment ledger is plan-level; all items on one appointment share a provider
  // and (in the common case) a plan, so payment is offered against the first
  // linked item's plan. A plan can owe in more than one currency.
  const primaryPlanItem = linkedTreatmentPlanItems[0] ?? null
  const showPlanTahsilat =
    primaryPlanItem !== null &&
    canManagePayments &&
    primaryPlanItem.currencyTotals.some((entry) => entry.remaining !== null && entry.remaining > 0)

  return (
    <PageContainer>
      <BreadcrumbLabel value={appointment.patientName} />
      <PageHeader
        title={appointment.patientName}
        description={formatIstanbulDateTime(appointment.startsAt, { day: "numeric", month: "long", year: "numeric" })}
        actions={
          <AppointmentDeleteDialog
            appointmentId={appointment.id}
            patientName={appointment.patientName}
          />
        }
      />

      {showCompletionSuggestion && linkedTreatment && seriesDetail && (
        <InlineWarningBanner
          message={`Bu randevuya ait ${linkedTreatment.sessionNumber}. seans henüz tamamlanmadı.`}
          action={
            <CompleteSessionButton
              seriesId={seriesDetail.id}
              sessionNumber={linkedTreatment.sessionNumber}
              label={`${linkedTreatment.sessionNumber}. Seansı Tamamla`}
            />
          }
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <AppointmentInfoPanel appointment={appointment} />

          {primaryPlanItem && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>{linkedTreatmentPlanItems.length > 1 ? "Tedaviler" : "Tedavi Planı"}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-col gap-3">
                  {linkedTreatmentPlanItems.map((item) => (
                    <div
                      key={item.treatmentPlanItemId}
                      className="flex flex-col gap-1 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-3"
                    >
                      <div className="flex items-center gap-x-4 gap-y-1">
                        <span className="min-w-0 flex-1 truncate font-medium">{item.treatmentName}</span>
                        {item.hasCompletedSessionForAppointment && (
                          <Badge variant="success">Bu randevu için tamamlandı</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.providerName} · {item.completedSessions} / {item.sessionCount} Seans Tamamlandı
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-1 flex flex-col gap-2">
                  {primaryPlanItem.currencyTotals.map((entry) => (
                    <div key={entry.currency} className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/20 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Toplam</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {entry.total === null ? "Belirlenmedi" : formatCurrency(entry.total, entry.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ödenen</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {formatCurrency(entry.paid, entry.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Kalan</p>
                        <p
                          className={cn(
                            "mt-0.5 text-sm font-semibold tabular-nums",
                            entry.remaining !== null && entry.remaining > 0 && "text-warning",
                          )}
                        >
                          {entry.remaining === null ? "—" : formatCurrency(entry.remaining, entry.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Hızlı İşlemler</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <AppointmentEditSheet
                appointment={appointment}
                patientOptions={patientOptions}
                staffOptions={staffOptions}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil />
                    Randevuyu Düzenle
                  </Button>
                }
              />
              {showTedaviBaslat && (
                <TreatmentEntrySheet
                  patientId={appointment.patientId}
                  staffOptions={staffOptions}
                  defaultAppointmentId={appointment.id}
                  defaultStaffId={appointment.staffId}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Stethoscope />
                      Tedavi Başlat
                    </Button>
                  }
                />
              )}
              {showCompleteSessionAction && linkedTreatment && seriesDetail && (
                <CompleteSessionButton
                  seriesId={seriesDetail.id}
                  sessionNumber={linkedTreatment.sessionNumber}
                  label={`${linkedTreatment.sessionNumber}. Seansı Tamamla`}
                />
              )}
              {completableItems.map((item) => (
                <CompleteSessionSheet
                  key={item.treatmentPlanItemId}
                  treatmentPlanItemId={item.treatmentPlanItemId}
                  treatmentName={item.treatmentName}
                  appointmentId={appointment.id}
                  nextSessionNumber={item.completedSessions + 1}
                  staffOptions={staffOptions}
                  defaultStaffId={treatmentPlanActor.staffId || item.providerId}
                  trigger={
                    <Button size="sm" variant="success">
                      <CheckCircle2 />
                      {linkedTreatmentPlanItems.length > 1
                        ? `${item.treatmentName}: Seansı Tamamla`
                        : `${item.completedSessions + 1}. Seansı Tamamla`}
                    </Button>
                  }
                />
              ))}
              {showTahsilatYap && seriesDetail && (
                <AddPaymentSheet
                  seriesId={seriesDetail.id}
                  remainingBalance={seriesDetail.remainingBalance}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Wallet />
                      Tahsilat Yap
                    </Button>
                  }
                />
              )}
              {showPlanTahsilat && primaryPlanItem && (
                <AppointmentPlanPaymentButton
                  treatmentPlanId={primaryPlanItem.treatmentPlanId}
                  currencyBalances={primaryPlanItem.currencyTotals.map((entry) => ({
                    currency: entry.currency,
                    remaining: entry.remaining,
                  }))}
                />
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href={`/patients/${appointment.patientId}`}>
                  <UserRound />
                  Hasta Kartına Git
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-8">
          <PageSection title="Aktivite Geçmişi">
            <AppointmentActivityTimeline
              appointmentId={appointment.id}
              activities={activities}
              canAddNote
            />
          </PageSection>
        </div>
      </div>
    </PageContainer>
  )
}

export { AppointmentDetailView }

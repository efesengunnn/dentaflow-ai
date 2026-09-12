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
  linkedTreatmentPlanItem,
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
  /** Sprint 28D — the new-model sibling of `seriesDetail`. An appointment has at most one of the two, never both. */
  linkedTreatmentPlanItem: AppointmentLinkedTreatmentPlanItem | null
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

  const showTedaviBaslat = !linkedTreatment && canManageTreatments
  const showTahsilatYap =
    seriesDetail !== null && canManagePayments && seriesDetail.remainingBalance !== null && seriesDetail.remainingBalance > 0

  // Sprint 28D — new-model sibling of `showCompleteSessionAction` above.
  // `hasCompletedSessionForAppointment` mirrors the same idempotency check
  // `completeTreatmentSession` re-verifies server-side, so the button never
  // offers an action the action itself would reject.
  const showPlanCompleteSessionAction =
    linkedTreatmentPlanItem !== null &&
    !linkedTreatmentPlanItem.hasCompletedSessionForAppointment &&
    linkedTreatmentPlanItem.remainingSessions > 0 &&
    linkedTreatmentPlanItem.itemStatus === "active" &&
    canCompleteSession(treatmentPlanActor)

  // Sprint 31 — new-model sibling of `showTahsilatYap` (legacy series) above.
  // The appointment panel previously offered payment only for the legacy
  // series model; a standalone/plan-linked appointment showed a price but no
  // way to collect against it (founder bug report 2026-09-11).
  const showPlanTahsilat =
    linkedTreatmentPlanItem !== null &&
    canManagePayments &&
    linkedTreatmentPlanItem.remainingBalance !== null &&
    linkedTreatmentPlanItem.remainingBalance > 0

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

          {linkedTreatmentPlanItem && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Tedavi Planı</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1 truncate font-medium">{linkedTreatmentPlanItem.treatmentName}</span>
                  {linkedTreatmentPlanItem.hasCompletedSessionForAppointment && (
                    <Badge variant="success">Bu randevu için tamamlandı</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{linkedTreatmentPlanItem.planName}</p>
                <p className="text-sm text-muted-foreground">{linkedTreatmentPlanItem.providerName}</p>
                <p className="text-sm text-muted-foreground">
                  {linkedTreatmentPlanItem.completedSessions} / {linkedTreatmentPlanItem.sessionCount} Seans Tamamlandı
                </p>

                <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl border bg-muted/20 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Toplam</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {linkedTreatmentPlanItem.totalAmount === null
                        ? "Belirlenmedi"
                        : `${linkedTreatmentPlanItem.totalAmount.toLocaleString("tr-TR")} ${linkedTreatmentPlanItem.currency}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ödenen</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {linkedTreatmentPlanItem.paidAmount.toLocaleString("tr-TR")} {linkedTreatmentPlanItem.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kalan</p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm font-semibold tabular-nums",
                        linkedTreatmentPlanItem.remainingBalance !== null &&
                          linkedTreatmentPlanItem.remainingBalance > 0 &&
                          "text-warning",
                      )}
                    >
                      {linkedTreatmentPlanItem.remainingBalance === null
                        ? "—"
                        : `${linkedTreatmentPlanItem.remainingBalance.toLocaleString("tr-TR")} ${linkedTreatmentPlanItem.currency}`}
                    </p>
                  </div>
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
              {showPlanCompleteSessionAction && linkedTreatmentPlanItem && (
                <CompleteSessionSheet
                  treatmentPlanItemId={linkedTreatmentPlanItem.treatmentPlanItemId}
                  treatmentName={linkedTreatmentPlanItem.treatmentName}
                  appointmentId={appointment.id}
                  nextSessionNumber={linkedTreatmentPlanItem.completedSessions + 1}
                  staffOptions={staffOptions}
                  defaultStaffId={treatmentPlanActor.staffId || linkedTreatmentPlanItem.providerId}
                  trigger={
                    <Button size="sm" variant="success">
                      <CheckCircle2 />
                      {linkedTreatmentPlanItem.completedSessions + 1}. Seansı Tamamla
                    </Button>
                  }
                />
              )}
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
              {showPlanTahsilat && linkedTreatmentPlanItem && (
                <AppointmentPlanPaymentButton
                  treatmentPlanId={linkedTreatmentPlanItem.treatmentPlanId}
                  remainingBalance={linkedTreatmentPlanItem.remainingBalance}
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

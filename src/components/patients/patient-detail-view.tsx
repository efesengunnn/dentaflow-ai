import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarDays, FileText, History, Pencil, Plus, Stethoscope, Wallet } from "lucide-react"
import Link from "next/link"

import { AppointmentAgendaList } from "@/components/appointments/appointment-agenda-list"
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { CollapsibleToggleTrigger } from "@/components/shared/collapsible-toggle-trigger"
import { InfoGrid } from "@/components/shared/info-grid"
import { PageContainer } from "@/components/shared/page-container"
import { PageSection } from "@/components/shared/page-section"
import { PlaceholderCard } from "@/components/shared/placeholder-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { cn, getInitials } from "@/lib/utils"
import type { AIPatientSummary } from "@/lib/ai/queries"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { formatIstanbulDateTime } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientActivityRow, PatientDetail, PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import type { TreatmentSeriesDetail } from "@/lib/treatments/queries"
import { TreatmentPlanList } from "@/components/treatment-plans/treatment-plan-list"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"
import { AppointmentErrorToast } from "./appointment-error-toast"
import { PatientActivityTimeline } from "./patient-activity-timeline"
import { PatientAIInsightsPanel } from "./patient-ai-insights-panel"
import { PatientDeleteDialog } from "./patient-delete-dialog"
import { PatientEditSheet } from "./patient-edit-sheet"
import { PatientInfoPanel } from "./patient-info-panel"
import { PatientPaymentsSection } from "./patient-payments-section"
import { PatientPlanPaymentSheet } from "./patient-plan-payment-sheet"

/**
 * Sprint 21 — Premium Visual Redesign. Right column is a stack of
 * `PageSection`s — same pattern as `LeadDetailView` (Sprint 3). Adding a
 * real Appointments/Treatments/Documents/AI module later means inserting
 * one more `PageSection` here, not redesigning this page — that's the
 * "future modules slot in easily" requirement satisfied by an already-proven
 * layout, not new scaffolding.
 */
function PatientDetailView({
  patient,
  activities,
  appointments,
  staffOptions,
  patientOptions,
  canManage,
  treatmentSeries,
  canManagePayments,
  isOwner,
  treatmentPlanActor,
  treatmentPlans,
  appointmentError,
  aiSummary,
}: {
  patient: PatientDetail
  activities: PatientActivityRow[]
  appointments: AppointmentListRow[]
  staffOptions: AssignableStaff[]
  patientOptions: PatientOption[]
  canManage: boolean
  treatmentSeries: TreatmentSeriesDetail[]
  canManagePayments: boolean
  /** Tedavi Planı wizard'ının/kart listesinin owner-only `provider_share` gate'i için. */
  isOwner: boolean
  /** Sprint 28C.1 — plan/kalem/seans silme butonlarının UI gate'i için (bkz. lib/treatment-plans/permissions.ts). */
  treatmentPlanActor: TreatmentPlanActor
  /** Sprint 28C — gerçek DB'den, sayfa seviyesinde önceden çekilmiş. */
  treatmentPlans: TreatmentPlanDetail[]
  appointmentError?: string
  aiSummary: AIPatientSummary | null
}) {
  // Header summary. `remainingBalance`/`totalFee` are `null` for a series
  // whose fee isn't set yet ("Belirlenmedi"); those contribute 0 here — an
  // unknown fee can't be counted as owed until someone sets it. Sprint 16 —
  // all three totals (Toplam Borç/Toplam Tahsilat/Kalan Bakiye) come from
  // the exact same already-fetched `treatmentSeries` prop, no new query;
  // `totalRemainingBalance` was already computed this way since Sprint 8,
  // just extended with the other two sums here rather than re-derived
  // elsewhere.
  const visibleSeriesForTotals = treatmentSeries.filter((series) => series.status !== "voided")
  const totalFee = visibleSeriesForTotals.reduce((sum, series) => sum + (series.totalFee ?? 0), 0)
  const totalPaid = visibleSeriesForTotals.reduce((sum, series) => sum + series.paidAmount, 0)
  const totalRemainingBalance = visibleSeriesForTotals.reduce((sum, series) => sum + (series.remainingBalance ?? 0), 0)
  const hasAnyFee = visibleSeriesForTotals.some((series) => series.totalFee !== null)

  const now = new Date()
  const nextAppointment = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
  // Sprint 17 — "Son Randevu", the same already-fetched `appointments` prop,
  // just the mirror-image filter/sort of `nextAppointment` above (past
  // instead of future, soonest-first instead of latest-first). No new query.
  const lastAppointment = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.startsAt) <= now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0]

  // Sprint 17 — "Son Tahsilat": every series already carries its own
  // `payments` list (paid_at DESC) from `getTreatmentSeriesForPatientWithDetails`
  // — flattening and re-sorting across series in memory finds the patient-wide
  // latest collection without a new or extended query. `refund`/`adjustment`
  // entries are excluded — "son tahsilat" means money collected, not a
  // correction to a prior one.
  const lastPayment = visibleSeriesForTotals
    .flatMap((series) => series.payments)
    .filter((payment) => payment.entryType === "payment")
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0]

  const hasBalanceDue = totalRemainingBalance > 0

  // Sprint 29 — "Yaklaşan Randevu" card data: same already-computed
  // `nextAppointment` above, just the fields this compact card needs.
  // `procedureName` already covers plan-item/standalone/legacy-series in
  // that priority order (see `mapAppointmentListRow`) — `reason` is only
  // the last resort for a genuinely treatment-less appointment.
  const upcomingProcedure = nextAppointment?.procedureName ?? nextAppointment?.reason ?? null

  // Sprint 29 — "Ödemeler" bölümünün "Ödeme Ekle" seçenekleri: yeni sistemin
  // ödenebilir (voided olmayan, kalan bakiyesi olan/belirsiz) planları.
  const payablePlans = treatmentPlans
    .filter(
      (plan) =>
        plan.status !== "voided" &&
        plan.currencyTotals.some((entry) => entry.remaining === null || entry.remaining > 0),
    )
    .map((plan) => ({
      id: plan.id,
      planName: plan.planName,
      currencyBalances: plan.currencyTotals.map((entry) => ({ currency: entry.currency, remaining: entry.remaining })),
    }))

  // Sprint 24 — "Sonraki Randevu" moved out of this strip into the
  // "Yaklaşan Randevu" card above, so this strip only carries genuinely
  // *secondary* facts. The financial figures (Toplam Borç/Tahsilat/Son
  // Tahsilat) are gated behind `canManage` (every role except doctor) —
  // founder decision 2026-07-28: beauty_specialist and secretary can both
  // *see* a patient's balance, even though only owner/secretary/
  // beauty_specialist can actually collect a payment (`canManagePayments`,
  // used below for Ödemeler's "Ödeme Ekle" action).
  const statItems = [
    ...(hasAnyFee && canManage
      ? [
          { label: "Toplam Borç", value: `${totalFee.toLocaleString("tr-TR")} TRY` },
          { label: "Toplam Tahsilat", value: `${totalPaid.toLocaleString("tr-TR")} TRY` },
        ]
      : []),
    {
      label: "Son Randevu",
      value: lastAppointment
        ? formatIstanbulDateTime(lastAppointment.startsAt, { day: "numeric", month: "short" })
        : "—",
    },
    ...(canManage
      ? [
          {
            label: "Son Tahsilat",
            value: lastPayment
              ? `${lastPayment.amount.toLocaleString("tr-TR")} ${lastPayment.currency} · ${format(new Date(lastPayment.paidAt), "d MMM", { locale: tr })}`
              : "—",
          },
        ]
      : []),
  ]

  return (
    <PageContainer>
      <AppointmentErrorToast message={appointmentError} />
      <BreadcrumbLabel value={patient.fullName} />

      {/* Sprint 23 — reconsidered Sprint 22's single gradient hero: cramming
          identity, a big balance figure, and four action buttons into one
          colored block made it a busy control panel, not a calm identity
          zone (Stripe/Attio's customer-record headers stay quiet; actions
          live in a plain toolbar just below, not inside the branded block).
          Split back into three purposeful, unstyled-background zones:
          identity stays quiet, the toolbar is plain buttons with no card
          chrome, and Kalan Bakiye — the single most operationally relevant
          number on this page — gets promoted into its own hero stat instead
          of being a corner label in the header. */}
      {/* Project Evolution V2 — the avatar loses its tinted-square fill for a
          bare ring (a hero-scale identity moment doesn't need a color-block
          badge, per the "Editorial" audit direction), and the name moves to
          the display serif at genuine headline scale — the single largest
          typographic moment on the page, carrying "this is whose record you
          are looking at" on weight/size alone. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="ring-border text-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-medium ring-1">
            {getInitials(patient.fullName)}
          </div>
          <div>
            <h1 className="font-display text-4xl font-normal tracking-tight sm:text-5xl">{patient.fullName}</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">
              {formatTurkishPhoneDisplay(patient.phone)}
            </p>
          </div>
        </div>
        {canManage && <PatientDeleteDialog patientId={patient.id} patientName={patient.fullName} />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/appointments/new?patientId=${patient.id}`}>
            <Plus />
            Randevu Oluştur
          </Link>
        </Button>
        {canManage && (
          <PatientEditSheet
            patient={patient}
            staffOptions={staffOptions}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil />
                Hastayı Düzenle
              </Button>
            }
          />
        )}
      </div>

      {/* Sprint 29 — "Yaklaşan Randevu": the single answer to "ne zaman
          gelecek", replacing the old "Sıradaki" banner (which mixed in a
          next-pending-session prompt from the now-hidden legacy Tedaviler
          system) and the full Randevular list below. Past appointments
          aren't gone — they move to Geçmiş. */}
      {nextAppointment && (
        <Card size="sm" className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-primary">Yaklaşan Randevu</p>
              <p className="text-sm font-medium">
                {formatIstanbulDateTime(nextAppointment.startsAt, { day: "numeric", month: "long" })}
              </p>
              <p className="text-muted-foreground text-sm">
                {upcomingProcedure ?? "İşlem belirtilmedi"} · {nextAppointment.staffName}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {(statItems.length > 0 || (hasAnyFee && canManage)) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
          {hasAnyFee && canManage && (
            <div
              className={cn(
                "flex flex-col justify-center rounded-2xl border p-6 sm:min-w-72",
                hasBalanceDue ? "border-warning/25 bg-warning/5" : "border-border bg-muted/20",
              )}
            >
              <p
                className={cn(
                  "text-[11px] font-semibold tracking-[0.08em] uppercase",
                  hasBalanceDue ? "text-warning" : "text-muted-foreground",
                )}
              >
                Kalan Bakiye
              </p>
              <p
                className={cn(
                  "font-display mt-1 text-5xl font-light tracking-tight tabular-nums",
                  hasBalanceDue && "text-warning",
                )}
              >
                {totalRemainingBalance.toLocaleString("tr-TR")} TRY
              </p>
            </div>
          )}
          <InfoGrid className="grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3" items={statItems} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <PatientInfoPanel patient={patient} />

        <div className="flex flex-col gap-8">
          {/* Sprint 29 — the 3-second test (founder mandate): "ne zaman
              gelecek" is answered above (Yaklaşan Randevu), so this stack
              opens with "hangi tedavisi devam ediyor" (Aktif Tedavi Planı),
              then "ne kadar borcu kaldı" (Ödemeler). The legacy Tedaviler
              (package) section is retired from this page — clean start with
              the Sprint 28 plan system; old records stay in the database,
              just no longer surfaced here. */}
          <PageSection
            title="Aktif Tedavi Planı"
            icon={Stethoscope}
            actions={
              <Button size="sm" variant="outline" asChild>
                <Link href={`/patients/${patient.id}/treatment-plans/new`}>
                  <Plus />
                  Paket / Tedavi Tanımla
                </Link>
              </Button>
            }
          >
            <TreatmentPlanList
              plans={treatmentPlans}
              isOwner={isOwner}
              providers={staffOptions}
              actor={treatmentPlanActor}
            />
          </PageSection>

          <PageSection
            title="Ödemeler"
            icon={Wallet}
            actions={canManagePayments && <PatientPlanPaymentSheet planOptions={payablePlans} />}
          >
            <PatientPaymentsSection treatmentPlans={treatmentPlans} />
          </PageSection>

          {/* Founder feedback 2026-08-11 (live testing): "Yaklaşan Randevu"
              alone wasn't enough — every appointment created for this patient
              (past and upcoming) needs its own detailed, actionable section,
              not folded into Geçmiş as a footnote. Reuses `AppointmentAgendaList`
              exactly as its own doc comment anticipated (`linkTarget="appointment"`
              — once you're already on the patient, drilling into one specific
              appointment is the useful next step), so Düzenle/İptal Et/Sil are
              reachable right here, not just from the appointment's own page. */}
          <PageSection title="Randevular" icon={CalendarDays}>
            <AppointmentAgendaList
              appointments={appointments}
              emptyTitle="Henüz randevu yok"
              emptyDescription="Bu hasta için ilk randevuyu oluşturduğunuzda burada listelenmeye başlayacak."
              newAppointmentHref={`/appointments/new?patientId=${patient.id}`}
              linkTarget="appointment"
              canManagePayments={canManagePayments}
              patientOptions={patientOptions}
              staffOptions={staffOptions}
            />
          </PageSection>

          {/* Sprint 29 — "Geçmiş" (renamed from "Aktivite Geçmişi"). Past
              appointments moved into the "Randevular" section above
              (2026-08-11) — this stays the activity/notes timeline only. */}
          <PageSection title="Geçmiş" icon={History}>
            <PatientActivityTimeline
              patientId={patient.id}
              activities={activities}
              canAddNote={canManage}
            />
          </PageSection>

          {/* Sprint 29 — AI Özet defaults collapsed (founder decision: AI box
              off by default). Reuses the same Collapsible/CollapsibleToggleTrigger
              pattern already used 5 other places, no new primitive. */}
          <Collapsible>
            <CollapsibleToggleTrigger>
              <span className="text-lg font-semibold tracking-tight text-foreground">AI Özet</span>
            </CollapsibleToggleTrigger>
            <CollapsibleContent className="pt-4">
              <PatientAIInsightsPanel summary={aiSummary} />
            </CollapsibleContent>
          </Collapsible>

          {/* Sprint 21 — Belgeler henüz gerçek bir modül değil. */}
          <PageSection title="Yakında">
            <PlaceholderCard
              icon={FileText}
              text="Belge yönetimi henüz aktif değil — rıza formları ve diğer belgeler burada saklanabilecek."
            />
          </PageSection>
        </div>
      </div>
    </PageContainer>
  )
}

export { PatientDetailView }

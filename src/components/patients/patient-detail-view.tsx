import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  CalendarClock,
  CalendarDays,
  FileText,
  History,
  Pencil,
  Plus,
  Stethoscope,
  Wallet,
} from "lucide-react"
import Link from "next/link"

import { AppointmentAgendaList } from "@/components/appointments/appointment-agenda-list"
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { CollapsibleToggleTrigger } from "@/components/shared/collapsible-toggle-trigger"
import { PageContainer } from "@/components/shared/page-container"
import { PageSection } from "@/components/shared/page-section"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, getInitials } from "@/lib/utils"
import type { AIPatientSummary } from "@/lib/ai/queries"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import type { PatientDocument } from "@/lib/documents/queries"
import { formatCurrency } from "@/lib/format/currency"
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
import { PatientDocumentsSection } from "./patient-documents-section"
import { PatientEditSheet } from "./patient-edit-sheet"
import { PatientInfoPanel } from "./patient-info-panel"
import { PatientPaymentsSection } from "./patient-payments-section"
import { PatientPlanPaymentSheet } from "./patient-plan-payment-sheet"

/** TRY first, then the rest — matches the ledger's per-currency order elsewhere. */
function sortCurrencyEntries(entries: { currency: string; amount: number }[]) {
  return [...entries].sort((a, b) =>
    a.currency === "TRY" ? -1 : b.currency === "TRY" ? 1 : a.currency.localeCompare(b.currency),
  )
}

/**
 * One compact headline figure in the KPI strip. Neutral by default; `warning`
 * tone (amber) is reserved for an outstanding balance, the one number a
 * clinic acts on. Same label/figure treatment as the dashboard's financial
 * cards, scaled down for a 3-up strip.
 */
function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "warning"
  icon: typeof Wallet
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-5",
        tone === "warning" ? "border-warning/25 bg-warning/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", tone === "warning" ? "text-warning" : "text-muted-foreground")} />
        <p
          className={cn(
            "text-[11px] font-semibold tracking-[0.08em] uppercase",
            tone === "warning" ? "text-warning" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
      </div>
      <p className={cn("truncate text-2xl font-semibold tracking-tight tabular-nums", tone === "warning" && "text-warning")}>
        {value}
      </p>
      {hint && <p className="text-muted-foreground/80 truncate text-xs">{hint}</p>}
    </div>
  )
}

/**
 * Sprint 33 — Patient card UX redesign (founder request: "bölümler karışık").
 * The page now reads as: quiet identity band → a 3-up KPI strip answering the
 * three questions a clinic asks first (balance / next visit / last visit) →
 * a two-column body with a sticky personal-info panel and the operational
 * content grouped into tabs (Tedavi & Ödeme / Randevular / Geçmiş) instead of
 * one long six-section scroll.
 *
 * Financial figures now come from the NEW treatment_plans model
 * (`treatmentPlans`, per currency) — consistent with the Ödemeler section —
 * not the legacy `treatment_series` totals the header used before, which were
 * empty for plan-only patients (see [[dashboard-financial-is-legacy-only]]).
 */
function PatientDetailView({
  patient,
  activities,
  appointments,
  staffOptions,
  patientOptions,
  canManage,
  clinicId,
  documents,
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
  /** Sprint 33 — current staff's clinic, needed to build the clinic-scoped document Storage path. */
  clinicId: string
  documents: PatientDocument[]
  /** Kept for the page's data contract; the header no longer derives totals from the legacy series model. */
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
  const now = new Date()

  const nextAppointment = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
  const lastAppointment = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.startsAt) <= now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0]
  const upcomingProcedure = nextAppointment?.procedureName ?? nextAppointment?.reason ?? null

  // --- Financials from the new plan model, per currency ---------------------
  const activePlans = treatmentPlans.filter((plan) => plan.status !== "voided")

  const balanceByCurrency = new Map<string, number>()
  for (const plan of activePlans) {
    for (const entry of plan.currencyTotals) {
      if (entry.remaining !== null) {
        balanceByCurrency.set(entry.currency, (balanceByCurrency.get(entry.currency) ?? 0) + entry.remaining)
      }
    }
  }
  const outstanding = sortCurrencyEntries(
    Array.from(balanceByCurrency.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .filter((entry) => entry.amount > 0),
  )
  const hasBalanceDue = outstanding.length > 0
  const balanceValue = hasBalanceDue
    ? outstanding.map((entry) => formatCurrency(entry.amount, entry.currency)).join(" + ")
    : formatCurrency(0, "TRY")

  const lastPayment = activePlans
    .flatMap((plan) => plan.payments)
    .filter((payment) => payment.entryType === "payment")
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0]

  // Payable plans for the "Ödeme Ekle" action (non-voided, with an open/unknown balance).
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

  return (
    <PageContainer>
      <AppointmentErrorToast message={appointmentError} />
      <BreadcrumbLabel value={patient.fullName} />

      {/* Identity band — quiet, editorial. Actions sit to the right; the
          destructive delete is a subdued ghost icon so it never competes with
          the primary actions (Sprint 33 UX pass). */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="ring-border text-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-medium ring-1">
            {getInitials(patient.fullName)}
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-3xl font-normal tracking-tight sm:text-4xl">{patient.fullName}</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">{formatTurkishPhoneDisplay(patient.phone)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
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
          {canManage && (
            <PatientDeleteDialog
              patientId={patient.id}
              patientName={patient.fullName}
              triggerLabel=""
              triggerVariant="ghost"
              triggerSize="icon-sm"
              triggerClassName="text-muted-foreground hover:text-destructive"
            />
          )}
        </div>
      </div>

      {/* KPI strip — the three questions a clinic asks first. */}
      <div className={cn("grid grid-cols-1 gap-4", canManage ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
        {canManage && (
          <KpiCard
            label="Kalan Bakiye"
            value={balanceValue}
            tone={hasBalanceDue ? "warning" : "default"}
            icon={Wallet}
            hint={
              lastPayment
                ? `Son tahsilat: ${formatCurrency(lastPayment.amount, lastPayment.currency)} · ${format(new Date(lastPayment.paidAt), "d MMM", { locale: tr })}`
                : "Henüz tahsilat yok"
            }
          />
        )}
        <KpiCard
          label="Yaklaşan Randevu"
          value={
            nextAppointment
              ? formatIstanbulDateTime(nextAppointment.startsAt, { day: "numeric", month: "long" })
              : "Yok"
          }
          icon={CalendarClock}
          hint={
            nextAppointment
              ? `${upcomingProcedure ?? "İşlem belirtilmedi"} · ${nextAppointment.staffName}`
              : "Planlanmış randevu yok"
          }
        />
        <KpiCard
          label="Son Randevu"
          value={
            lastAppointment
              ? formatIstanbulDateTime(lastAppointment.startsAt, { day: "numeric", month: "long" })
              : "—"
          }
          icon={CalendarDays}
          hint={lastAppointment ? (lastAppointment.procedureName ?? lastAppointment.staffName) : "Geçmiş randevu yok"}
        />
      </div>

      {/* Body — sticky personal info + tabbed operational content. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <PatientInfoPanel patient={patient} />
        </div>

        <Tabs defaultValue="tedavi">
          <TabsList>
            <TabsTrigger value="tedavi">
              <Stethoscope />
              Tedavi &amp; Ödeme
            </TabsTrigger>
            <TabsTrigger value="randevular">
              <CalendarDays />
              Randevular
            </TabsTrigger>
            <TabsTrigger value="belgeler">
              <FileText />
              Belgeler
            </TabsTrigger>
            <TabsTrigger value="gecmis">
              <History />
              Geçmiş
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tedavi" className="flex flex-col gap-8">
            <PageSection
              title="Aktif Tedavi Planı"
              icon={Stethoscope}
              actions={
                <Button size="sm" asChild>
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
          </TabsContent>

          <TabsContent value="randevular">
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
          </TabsContent>

          <TabsContent value="belgeler">
            <PatientDocumentsSection patientId={patient.id} clinicId={clinicId} documents={documents} />
          </TabsContent>

          <TabsContent value="gecmis" className="flex flex-col gap-8">
            <PatientActivityTimeline patientId={patient.id} activities={activities} canAddNote={canManage} />

            <Collapsible>
              <CollapsibleToggleTrigger>
                <span className="text-foreground text-lg font-semibold tracking-tight">AI Özet</span>
              </CollapsibleToggleTrigger>
              <CollapsibleContent className="pt-4">
                <PatientAIInsightsPanel summary={aiSummary} />
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}

export { PatientDetailView }

import { CalendarDays, FileText, History, Pencil, Plus, Stethoscope, Wallet } from "lucide-react"
import Link from "next/link"

import { AppointmentAgendaList } from "@/components/appointments/appointment-agenda-list"
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { PatientPaymentsSection } from "@/components/payments/patient-payments-section"
import { InfoGrid } from "@/components/shared/info-grid"
import { PageContainer } from "@/components/shared/page-container"
import { PageSection } from "@/components/shared/page-section"
import { PlaceholderCard } from "@/components/shared/placeholder-card"
import { DentalChartSection } from "@/components/teeth/dental-chart-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getInitials } from "@/lib/utils"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { formatIstanbulDateTime } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientBalance, PatientPaymentRow } from "@/lib/payments/queries"
import type { PatientActivityRow, PatientDetail, PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import type { ToothConditionRow, ToothTreatmentRow } from "@/lib/teeth/queries"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"
import { AppointmentErrorToast } from "./appointment-error-toast"
import { PatientActivityTimeline } from "./patient-activity-timeline"
import { PatientDeleteDialog } from "./patient-delete-dialog"
import { PatientEditSheet } from "./patient-edit-sheet"
import { PatientInfoPanel } from "./patient-info-panel"

/**
 * Right column is a stack of `PageSection`s — adding a real module later
 * means inserting one more `PageSection` here, not redesigning this page.
 */
function PatientDetailView({
  patient,
  activities,
  appointments,
  staffOptions,
  patientOptions,
  canManage,
  appointmentError,
  toothConditions,
  toothTreatments,
  catalog,
  balance,
  payments,
  canManagePayments,
  canManageClinical,
}: {
  patient: PatientDetail
  activities: PatientActivityRow[]
  appointments: AppointmentListRow[]
  staffOptions: AssignableStaff[]
  patientOptions: PatientOption[]
  canManage: boolean
  appointmentError?: string
  toothConditions: Map<number, ToothConditionRow>
  toothTreatments: ToothTreatmentRow[]
  catalog: CatalogItem[]
  balance: PatientBalance
  payments: PatientPaymentRow[]
  canManagePayments: boolean
  canManageClinical: boolean
}) {
  const now = new Date()
  const nextAppointment = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
  const lastAppointment = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.startsAt) <= now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0]

  const statItems = [
    {
      label: "Son Randevu",
      value: lastAppointment
        ? formatIstanbulDateTime(lastAppointment.startsAt, { day: "numeric", month: "short" })
        : "—",
    },
  ]

  return (
    <PageContainer>
      <AppointmentErrorToast message={appointmentError} />
      <BreadcrumbLabel value={patient.fullName} />

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

      {nextAppointment && (
        <Card size="sm" className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-primary">Yaklaşan Randevu</p>
              <p className="text-sm font-medium">
                {formatIstanbulDateTime(nextAppointment.startsAt, { day: "numeric", month: "long" })}
              </p>
              <p className="text-muted-foreground text-sm">
                {nextAppointment.reason ?? "İşlem belirtilmedi"} · {nextAppointment.staffName}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <InfoGrid className="grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3" items={statItems} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <PatientInfoPanel patient={patient} />

        <div className="flex flex-col gap-8">
          <PageSection title="Diş Haritası" icon={Stethoscope}>
            <DentalChartSection
              patientId={patient.id}
              conditions={toothConditions}
              treatments={toothTreatments}
              staffOptions={staffOptions}
              catalog={catalog}
              canManageClinical={canManageClinical}
            />
          </PageSection>

          <PageSection title="Ödemeler" icon={Wallet}>
            <PatientPaymentsSection
              patientId={patient.id}
              balance={balance}
              payments={payments}
              canManagePayments={canManagePayments}
            />
          </PageSection>

          <PageSection title="Randevular" icon={CalendarDays}>
            <AppointmentAgendaList
              appointments={appointments}
              emptyTitle="Henüz randevu yok"
              emptyDescription="Bu hasta için ilk randevuyu oluşturduğunuzda burada listelenmeye başlayacak."
              newAppointmentHref={`/appointments/new?patientId=${patient.id}`}
              linkTarget="appointment"
              patientOptions={patientOptions}
              staffOptions={staffOptions}
            />
          </PageSection>

          <PageSection title="Geçmiş" icon={History}>
            <PatientActivityTimeline
              patientId={patient.id}
              activities={activities}
              canAddNote={canManage}
            />
          </PageSection>

          <PageSection title="Yakında">
            <PlaceholderCard
              icon={FileText}
              text="Belge yönetimi (rıza formları, röntgenler) henüz aktif değil — bu bölüm burada yer alacak."
            />
          </PageSection>
        </div>
      </div>
    </PageContainer>
  )
}

export { PatientDetailView }

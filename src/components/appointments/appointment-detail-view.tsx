import { Pencil, UserRound } from "lucide-react"
import Link from "next/link"

import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { PageSection } from "@/components/shared/page-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AppointmentActivityRow, AppointmentDetail } from "@/lib/appointments/queries"
import { formatIstanbulDateTime } from "@/lib/format/date"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { AppointmentActivityTimeline } from "./appointment-activity-timeline"
import { AppointmentDeleteDialog } from "./appointment-delete-dialog"
import { AppointmentEditSheet } from "./appointment-edit-sheet"
import { AppointmentInfoPanel } from "./appointment-info-panel"

/**
 * Every role (owner/doctor/secretary) can manage appointments — see
 * docs/DATABASE.md's appointments RLS row: INSERT/UPDATE is open to all
 * roles, a deliberate difference from Leads/Patients' owner/secretary-only
 * write access.
 */
function AppointmentDetailView({
  appointment,
  activities,
  patientOptions,
  staffOptions,
}: {
  appointment: AppointmentDetail
  activities: AppointmentActivityRow[]
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
}) {
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <AppointmentInfoPanel appointment={appointment} />

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

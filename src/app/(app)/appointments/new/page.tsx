import { NewAppointmentForm } from "@/components/appointments/new-appointment-form"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { getPatientOptions } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"

type NewAppointmentPageProps = {
  searchParams: Promise<{ patientId?: string; date?: string; treatmentId?: string }>
}

/**
 * `?patientId=` prefills the patient combobox — how Patient Detail's
 * "Yeni Randevu Oluştur" action arrives here (founder requirement, Sprint 6
 * planning: the patient must already be selected, not re-picked). Sprint 13:
 * provider is never pre-filled from the patient — a patient can see
 * different staff on different visits, so "Sağlayıcı" is always chosen fresh
 * per appointment (see docs/DATABASE.md, "Sorumlu Personel" removal). Sprint
 * 11: `?date=` prefills "Tarih" — how the calendar's empty-day-list empty
 * state arrives here. `?treatmentId=` pre-selects a planned tooth treatment
 * in "Bağlı Tedaviler" — how the tooth detail sheet's "Bu Tedavi İçin
 * Randevu Oluştur" shortcut arrives here.
 */
export default async function NewAppointmentPage({ searchParams }: NewAppointmentPageProps) {
  const params = await searchParams

  const [patientOptions, staffOptions] = await Promise.all([getPatientOptions(), getAssignableStaff()])

  return (
    <PageContainer size="narrow">
      <PageHeader title="Yeni Randevu" description="Yeni bir randevu oluşturun." />
      <NewAppointmentForm
        patientOptions={patientOptions}
        staffOptions={staffOptions}
        defaultPatientId={params.patientId}
        defaultDate={params.date}
        defaultTreatmentId={params.treatmentId}
      />
    </PageContainer>
  )
}

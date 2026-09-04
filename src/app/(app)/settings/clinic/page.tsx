import { ClinicSettingsForm } from "@/components/settings/clinic-settings-form"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getClinicSettings } from "@/lib/clinic/queries"

export default async function ClinicSettingsPage() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return null

  const clinic = await getClinicSettings(staffMember.clinicId)
  if (!clinic) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Klinik" description="Klinik adı, iletişim bilgileri ve logo ayarları." />
      {staffMember.role === "owner" ? (
        <ClinicSettingsForm clinic={clinic} />
      ) : (
        <div className="flex max-w-xl flex-col gap-3 rounded-2xl border p-4 text-sm">
          <p className="text-muted-foreground">
            Klinik bilgilerini yalnızca klinik sahibi düzenleyebilir.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Klinik Adı</p>
              <p className="font-medium">{clinic.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Telefon</p>
              <p className="font-medium">{clinic.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">E-posta</p>
              <p className="font-medium">{clinic.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Çalışma Saatleri</p>
              <p className="font-medium">{clinic.businessHours ?? "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs">Adres</p>
              <p className="font-medium">{clinic.address ?? "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

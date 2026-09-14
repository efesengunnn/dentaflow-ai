import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { UserRound } from "lucide-react"

import { InfoRow } from "@/components/shared/info-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { dateStringToLocalDate } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientDetail } from "@/lib/patients/queries"

function PatientInfoPanel({ patient }: { patient: PatientDetail }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
            <UserRound className="size-4" />
          </div>
          <CardTitle>Kişisel Bilgiler</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InfoRow label="Ad Soyad" value={patient.fullName} />
        <InfoRow
          label="Telefon"
          value={<span className="font-mono">{formatTurkishPhoneDisplay(patient.phone)}</span>}
        />
        <InfoRow label="E-posta" value={patient.email ?? "—"} />
        <InfoRow label="TC Kimlik No" value={patient.tcKimlikNo ?? "—"} />
        <InfoRow
          label="Doğum Tarihi"
          value={
            patient.dateOfBirth
              ? format(dateStringToLocalDate(patient.dateOfBirth)!, "d MMMM yyyy", { locale: tr })
              : "—"
          }
        />
        <InfoRow
          label="Oluşturulma Tarihi"
          value={format(new Date(patient.createdAt), "d MMMM yyyy", { locale: tr })}
        />
      </CardContent>
    </Card>
  )
}

export { PatientInfoPanel }

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientListRow } from "@/lib/patients/queries"
import { getInitials } from "@/lib/utils"

function PatientCard({ patient }: { patient: PatientListRow }) {
  return (
    <Link href={`/patients/${patient.id}`}>
      <Card className="transition-shadow duration-150 hover:shadow-md">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(patient.fullName)}
              </div>
              <span className="min-w-0 truncate font-medium" title={patient.fullName}>
                {patient.fullName}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <span className="font-mono">{formatTurkishPhoneDisplay(patient.phone)}</span>
            {patient.email && <span className="truncate">{patient.email}</span>}
          </div>
          <p className="text-muted-foreground/70 text-xs">
            {format(new Date(patient.createdAt), "d MMM yyyy", { locale: tr })} tarihinde kaydedildi
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

export { PatientCard }

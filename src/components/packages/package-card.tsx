import { format } from "date-fns"
import { tr } from "date-fns/locale"
import Link from "next/link"

import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status-badge"
import { Card, CardContent } from "@/components/ui/card"
import type { TreatmentPlanListRow } from "@/lib/treatment-plans/queries"

function formatMoney(amount: number | null): string {
  return amount === null ? "Belirlenmedi" : `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

function PackageCard({ plan }: { plan: TreatmentPlanListRow }) {
  return (
    <Link href={`/packages/${plan.id}`}>
      <Card className="transition-shadow duration-150 hover:shadow-md">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-medium" title={plan.patientName}>
              {plan.patientName}
            </span>
            <TreatmentPlanStatusBadge status={plan.status} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{plan.planName}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground/70 text-xs">
              {format(new Date(plan.createdAt), "d MMM yyyy", { locale: tr })}
            </span>
            <span className="font-medium tabular-nums">{formatMoney(plan.totalAmount)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export { PackageCard }

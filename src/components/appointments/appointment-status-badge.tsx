import { Badge } from "@/components/ui/badge"
import {
  APPOINTMENT_STATUS_BADGE_VARIANT,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/appointments/constants"

function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge variant={APPOINTMENT_STATUS_BADGE_VARIANT[status]}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

export { AppointmentStatusBadge }

"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { AppointmentChip } from "./appointment-chip"

/** Month view's "+N more" overflow for a day with more appointments than the cell can show inline. */
function DayAppointmentsPopover({ date, appointments }: { date: Date; appointments: AppointmentListRow[] }) {
  return (
    <Popover>
      <PopoverTrigger className="w-full rounded-sm px-1.5 py-0.5 text-left text-xs text-muted-foreground hover:bg-muted">
        +{appointments.length} daha
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          {format(date, "d MMMM yyyy", { locale: tr })}
        </p>
        <div className="flex flex-col gap-1">
          {appointments.map((appointment) => (
            <AppointmentChip key={appointment.id} appointment={appointment} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DayAppointmentsPopover }

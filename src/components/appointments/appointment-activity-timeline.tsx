"use client"

import { CalendarPlus, MessageSquare, Pencil, RefreshCw, Trash2, type LucideIcon } from "lucide-react"

import { ActivityTimeline } from "@/components/shared/activity-timeline"
import { addAppointmentNote } from "@/lib/appointments/actions"
import type { AppointmentActivityRow } from "@/lib/appointments/queries"

const ACTIVITY_ICONS: Record<AppointmentActivityRow["activityType"], LucideIcon> = {
  appointment_created: CalendarPlus,
  appointment_updated: Pencil,
  status_changed: RefreshCw,
  note_added: MessageSquare,
  appointment_deleted: Trash2,
}

function AppointmentActivityTimeline({
  appointmentId,
  activities,
  canAddNote,
}: {
  appointmentId: string
  activities: AppointmentActivityRow[]
  canAddNote: boolean
}) {
  return (
    <ActivityTimeline
      activities={activities}
      icons={ACTIVITY_ICONS}
      onAddNote={canAddNote ? (note) => addAppointmentNote(appointmentId, note) : undefined}
    />
  )
}

export { AppointmentActivityTimeline }

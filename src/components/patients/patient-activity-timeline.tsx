"use client"

import { MessageSquare, Pencil, Sparkles, Trash2, type LucideIcon } from "lucide-react"

import { ActivityTimeline } from "@/components/shared/activity-timeline"
import { addPatientNote } from "@/lib/patients/actions"
import type { PatientActivityRow } from "@/lib/patients/queries"

const ACTIVITY_ICONS: Record<PatientActivityRow["activityType"], LucideIcon> = {
  patient_created: Sparkles,
  patient_updated: Pencil,
  note_added: MessageSquare,
  patient_deleted: Trash2,
}

function PatientActivityTimeline({
  patientId,
  activities,
  canAddNote,
}: {
  patientId: string
  activities: PatientActivityRow[]
  canAddNote: boolean
}) {
  return (
    <ActivityTimeline
      activities={activities}
      icons={ACTIVITY_ICONS}
      onAddNote={canAddNote ? (note) => addPatientNote(patientId, note) : undefined}
    />
  )
}

export { PatientActivityTimeline }

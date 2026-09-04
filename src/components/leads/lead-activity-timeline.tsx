"use client"

import { ArrowRightLeft, MessageSquare, Pencil, Sparkles, Trash2, type LucideIcon } from "lucide-react"

import { ActivityTimeline } from "@/components/shared/activity-timeline"
import { addLeadNote } from "@/lib/leads/actions"
import type { LeadActivityRow } from "@/lib/leads/queries"

const ACTIVITY_ICONS: Record<LeadActivityRow["activityType"], LucideIcon> = {
  lead_created: Sparkles,
  lead_updated: Pencil,
  status_changed: ArrowRightLeft,
  note_added: MessageSquare,
  lead_deleted: Trash2,
}

function LeadActivityTimeline({
  leadId,
  activities,
  canAddNote,
}: {
  leadId: string
  activities: LeadActivityRow[]
  canAddNote: boolean
}) {
  return (
    <ActivityTimeline
      activities={activities}
      icons={ACTIVITY_ICONS}
      onAddNote={canAddNote ? (note) => addLeadNote(leadId, note) : undefined}
    />
  )
}

export { LeadActivityTimeline }

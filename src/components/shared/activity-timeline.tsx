"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { MessageSquare, type LucideIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export type ActivityRow<TActivityType extends string = string> = {
  id: string
  activityType: TActivityType
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
  authorName: string | null
}

type ActivityTimelineProps<TActivityType extends string> = {
  activities: ActivityRow<TActivityType>[]
  /** Maps each possible `activityType` value to its timeline icon — one entry per real enum value, not string-keyed. */
  icons: Record<TActivityType, LucideIcon>
  /** Omit to hide the note composer entirely (e.g. read-only role). */
  onAddNote?: (note: string) => Promise<{ error?: string } | undefined>
  emptyDescription?: string
}

/**
 * Generic append-only activity/notes feed — the single source of truth
 * pattern established for Leads (Sprint 3) and reused as-is for Patients
 * (Sprint 4), parameterized only over the activity-type union and its icon
 * map so a third entity (Appointments, Treatments, ...) can reuse this
 * without touching this file, per PRODUCT_BLUEPRINT.md's AI Foundation goal
 * of one consistent operational-history shape across modules.
 */
function ActivityTimeline<TActivityType extends string>({
  activities,
  icons,
  onAddNote,
  emptyDescription = "Bu kayıt üzerinde yapılan işlemler burada listelenecek.",
}: ActivityTimelineProps<TActivityType>) {
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleAddNote() {
    const trimmed = note.trim()
    if (!trimmed || !onAddNote) return

    startTransition(async () => {
      const result = await onAddNote(trimmed)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setNote("")
      toast.success("Not eklendi.")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {onAddNote && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Bir not ekleyin..."
            rows={2}
          />
          <Button
            type="button"
            size="sm"
            className="self-end"
            disabled={!note.trim()}
            loading={isPending}
            onClick={handleAddNote}
          >
            Not Ekle
          </Button>
        </div>
      )}

      {activities.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Henüz aktivite yok" description={emptyDescription} />
      ) : (
        <ol className="flex flex-col gap-4">
          {activities.map((activity) => {
            const Icon: LucideIcon = icons[activity.activityType]
            return (
              <li key={activity.id} className="flex gap-3">
                <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 pt-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {activity.authorName ?? "Sistem"} ·{" "}
                    {format(new Date(activity.createdAt), "d MMMM yyyy, HH:mm", { locale: tr })}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export { ActivityTimeline }

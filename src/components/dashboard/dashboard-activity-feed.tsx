import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { History, UserPlus, UserRound } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import type { DashboardActivityRow } from "@/lib/dashboard/queries"

/**
 * Merged Lead + Patient activity feed — reads from `lead_activities` and
 * `patient_activities` (fetched separately, merged and sorted in
 * `getRecentActivities`), never a shared polymorphic table (see
 * DATABASE.md's `patient_activities` notes on why that generalization is
 * still deliberately deferred). `entity` tags each row so the icon shape and
 * link target can differ per source without needing a third table. Sprint
 * 20 — the icon badge is a single neutral tone for both sources (was
 * `primary`/`success`), since the color split was a category label, not a
 * real status; the icon shape alone (`UserPlus` lead vs. `UserRound`
 * patient) now carries the distinction.
 */
function DashboardActivityFeed({ activities }: { activities: DashboardActivityRow[] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Henüz aktivite yok"
        description="İlk kaydınızı oluşturduğunuzda (bir potansiyel müşteri ya da hasta) buradaki akışta görünmeye başlayacak."
      />
    )
  }

  return (
    <ol className="flex flex-col">
      {activities.map((activity) => (
        <li key={`${activity.entity}-${activity.id}`}>
          <Link
            href={`/${activity.entity === "lead" ? "leads" : "patients"}/${activity.entityId}`}
            className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
              {activity.entity === "lead" ? (
                <UserPlus className="size-4" />
              ) : (
                <UserRound className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm">{activity.description}</p>
              <p className="text-muted-foreground text-xs">
                {activity.authorName ?? "Sistem"} ·{" "}
                {formatDistanceToNow(new Date(activity.createdAt), {
                  addSuffix: true,
                  locale: tr,
                })}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export { DashboardActivityFeed }

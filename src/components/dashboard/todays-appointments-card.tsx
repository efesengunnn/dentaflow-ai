"use client"

import { ArrowRight, CalendarClock, Check, LogIn, Loader2Icon, Package, UserRound, Wallet } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { updateAppointment } from "@/lib/appointments/actions"
import { appointmentStatusUpdatePayload } from "@/lib/appointments/schema"
import type { DashboardAppointmentRow } from "@/lib/dashboard/queries"
import { AddPaymentSheet } from "@/components/treatments/add-payment-sheet"
import { completeSession } from "@/lib/treatments/actions"
import { getInitials } from "@/lib/utils"

/**
 * Sprint 24 (Project Evolution) — a design audit found this list was purely
 * chronological: a patient who's arrived and is waiting to be checked out
 * carried the same visual weight as one already completed an hour ago. A
 * real front-desk queue treats "who's waiting on me right now" as the first
 * thing to scan, not just another row in time order. Reordered by what the
 * status actually means operationally — `confirmed` (arrived, waiting to be
 * completed) first, `scheduled` (not yet arrived) next, `completed`/
 * `cancelled`/`no_show` (already resolved, no action left) last — each
 * group still chronological internally. Uses only the `status` field every
 * row already carries; no new data, no schema change.
 */
const QUEUE_RANK: Record<AppointmentStatus, number> = {
  confirmed: 0,
  scheduled: 1,
  completed: 2,
  cancelled: 3,
  no_show: 3,
}

function sortForQueue(appointments: DashboardAppointmentRow[]): DashboardAppointmentRow[] {
  return [...appointments].sort((a, b) => {
    const rankDiff = QUEUE_RANK[a.status] - QUEUE_RANK[b.status]
    if (rankDiff !== 0) return rankDiff
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  })
}

function isResolved(status: AppointmentStatus): boolean {
  return status === "completed" || status === "cancelled" || status === "no_show"
}

/**
 * "Bugünkü Randevular" (Sprint 15) — a dedicated card, not the generic
 * `RecentListCard`, because this row needs appointment-specific quick
 * actions (Geldi/Tamamlandı) that a purely generic "recent list" shape
 * (title/subtitle/href/meta) can't carry without polluting every other
 * `RecentListCard` consumer. Both actions reuse `updateAppointment`
 * unchanged (via `appointmentStatusUpdatePayload`) — no new Server Action.
 * "Tamamlandı" additionally offers completing the linked session, via the
 * existing Mini Sprint `completeSession` action, when one is attached.
 *
 * Sprint 18 — Randevular > Bugün reuses this exact card instead of running
 * its own parallel list (`title`/`viewAllHref` let it drop the "Bugünkü
 * Randevular" heading + "Tümünü Gör" link when embedded full-page). Rows
 * also gain paket/seans/"Tahsilat Bekliyor" info and 💳 Tahsilat / 👤 Hasta
 * Kartı actions, reusing `AddPaymentSheet` — no new payment UI.
 */
function TodaysAppointmentsCard({
  appointments,
  canManagePayments,
  title = "Bugünkü Randevular",
  viewAllHref,
}: {
  appointments: DashboardAppointmentRow[]
  canManagePayments: boolean
  title?: string
  /** Omitted on Randevular > Bugün itself — hides the "Tümünü Gör" button, since you're already on the full list. */
  viewAllHref?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sessionConfirmTarget, setSessionConfirmTarget] = useState<DashboardAppointmentRow | null>(null)

  function handleArrived(row: DashboardAppointmentRow) {
    setPendingId(row.id)
    startTransition(async () => {
      const result = await updateAppointment(row.id, appointmentStatusUpdatePayload(row, "confirmed"))
      setPendingId(null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Hasta geldi olarak işaretlendi.")
      router.refresh()
    })
  }

  function handleComplete(row: DashboardAppointmentRow) {
    setPendingId(row.id)
    startTransition(async () => {
      const result = await updateAppointment(row.id, appointmentStatusUpdatePayload(row, "completed"))
      setPendingId(null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Randevu tamamlandı.")
      if (row.linkedTreatment && row.linkedTreatment.sessionStatus === "active") {
        setSessionConfirmTarget(row)
      } else {
        router.refresh()
      }
    })
  }

  function handleConfirmSession() {
    const linkedTreatment = sessionConfirmTarget?.linkedTreatment
    if (!linkedTreatment) return
    startTransition(async () => {
      const result = await completeSession(linkedTreatment.seriesId, linkedTreatment.sessionNumber)
      if (result?.error) toast.error(result.error)
      else toast.success(`${linkedTreatment.sessionNumber}. seans tamamlandı.`)
      setSessionConfirmTarget(null)
      router.refresh()
    })
  }

  function handleDeclineSession() {
    setSessionConfirmTarget(null)
    router.refresh()
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{title}</CardTitle>
          {viewAllHref && (
            <Button asChild variant="ghost" size="sm">
              <Link href={viewAllHref}>
                Tümünü Gör
                <ArrowRight />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Bugün randevu bulunmuyor"
              description="Bugüne ait randevular burada listelenecek."
            />
          ) : (
            <ul className="flex flex-col">
              {sortForQueue(appointments).map((appointment, index, queue) => {
                const canMarkArrived = appointment.status === "scheduled"
                const canMarkCompleted = appointment.status === "scheduled" || appointment.status === "confirmed"
                const rowPending = isPending && pendingId === appointment.id
                const { linkedTreatment } = appointment
                const hasBalanceDue =
                  linkedTreatment !== null && linkedTreatment.remainingBalance !== null && linkedTreatment.remainingBalance > 0
                // Only label the seam between "still to happen today" and
                // "already resolved" when both groups are actually present —
                // a label above a single uniform list would just be noise.
                const startsResolvedGroup =
                  isResolved(appointment.status) && index > 0 && !isResolved(queue[index - 1].status)

                return (
                  <li key={appointment.id} className="contents">
                    {startsResolvedGroup && (
                      <p className="text-muted-foreground/70 mt-2 mb-1 px-2 text-xs font-medium tracking-wide uppercase first:mt-0">
                        Tamamlanan
                      </p>
                    )}
                    <div className="-mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted/50">
                    {/* Project Evolution V2 bugfix — this row is now reused
                        inside the narrow per-doctor board columns
                        (Sprint 25), not just the full-width Dashboard/Bugün
                        list it was originally sized for. `sm:flex` on the
                        treatment-badge column below is a *viewport* breakpoint,
                        not a container one — on a wide desktop viewport it
                        stays visible even when its actual column is only
                        ~250px wide, and an unconstrained `flex-1` name block
                        was losing the resulting space fight to the
                        actions row's non-shrinking buttons, crushing the
                        patient's name down to a single letter. A minimum
                        width floor forces the row to wrap (it already has
                        `flex-wrap`) instead of destroying legibility. */}
                    <div className="flex min-w-40 flex-1 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(appointment.patientName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/patients/${appointment.patientId}`} className="hover:underline">
                          <p className="truncate text-sm font-medium">{appointment.patientName}</p>
                          <p className="text-muted-foreground truncate text-xs">{appointment.staffName}</p>
                        </Link>
                      </div>
                    </div>
                    <div className="hidden min-w-0 flex-1 sm:flex sm:items-center">
                      {linkedTreatment && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="gap-1">
                            <Package />
                            {linkedTreatment.treatmentType} · {linkedTreatment.sessionNumber}/{linkedTreatment.totalSessions}{" "}
                            Seans
                          </Badge>
                          {hasBalanceDue && (
                            <Badge variant="warning" className="gap-1">
                              <Wallet />
                              Tahsilat Bekliyor
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {new Date(appointment.startsAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <AppointmentStatusBadge status={appointment.status} />
                      <Button variant="ghost" size="icon-sm" asChild aria-label="Hasta Kartını Aç">
                        <Link href={`/patients/${appointment.patientId}`}>
                          <UserRound />
                        </Link>
                      </Button>
                      {canMarkArrived && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={rowPending}
                          onClick={() => handleArrived(appointment)}
                        >
                          <LogIn />
                          Geldi
                        </Button>
                      )}
                      {canMarkCompleted && (
                        <Button size="sm" loading={rowPending} onClick={() => handleComplete(appointment)}>
                          <Check />
                          Tamamlandı
                        </Button>
                      )}
                      {hasBalanceDue && canManagePayments && linkedTreatment && (
                        <AddPaymentSheet
                          seriesId={linkedTreatment.seriesId}
                          remainingBalance={linkedTreatment.remainingBalance}
                          title="Tahsilat Yap"
                          description={`${linkedTreatment.treatmentType} paketi için tahsilat kaydedin.`}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Wallet />
                              Tahsilat
                            </Button>
                          }
                          onSuccess={() => router.refresh()}
                        />
                      )}
                    </div>
                  </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={sessionConfirmTarget !== null} onOpenChange={(open) => !open && handleDeclineSession()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seansı da tamamlamak ister misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              {sessionConfirmTarget?.patientName} için {sessionConfirmTarget?.linkedTreatment?.sessionNumber}. seansı
              da tamamlanmış olarak işaretleyebilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeclineSession}>Hayır</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSession} disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {isPending ? "İşleniyor..." : "Evet, Seansı Tamamla"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { TodaysAppointmentsCard }

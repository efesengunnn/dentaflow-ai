"use client"

import { CalendarClock, CalendarX2, Loader2Icon, MoreVertical, Pencil, Plus, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { removeAppointment, updateAppointment } from "@/lib/appointments/actions"
import type { AppointmentListRow } from "@/lib/appointments/queries"
import { appointmentStatusUpdatePayload } from "@/lib/appointments/schema"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { getInitials } from "@/lib/utils"
import { AppointmentEditSheet } from "./appointment-edit-sheet"
import { AppointmentStatusBadge } from "./appointment-status-badge"

/**
 * The daily schedule list — used on `/appointments?view=today` and,
 * since Sprint 11, embedded directly under the calendar for the selected
 * day. Single-column by nature, so unlike Month/Week there is no separate
 * mobile branch needed — this list is already fully usable on a phone.
 *
 * `linkTarget` defaults to the patient's card (Sprint 14 — every appointment
 * surface outside a patient's own Randevular section lands on the same
 * patient screen as the Hastalar module, consistent navigation). The one
 * exception is `PatientDetailView`'s own Randevular list, which sets it to
 * "appointment" — once you're already on a patient, drilling into one
 * specific appointment to edit it is the useful next step, not a second trip
 * to the same patient card.
 *
 * Sprint 15 — client component now: each row carries a "⋮" quick-actions
 * menu (Hasta Kartını Aç / Randevuyu Düzenle / Randevuyu İptal Et / Tedaviyi
 * Aç), so only the patient name itself is a `<Link>` — the row is no longer
 * one giant clickable card, both to make room for the menu without nesting
 * interactive elements and per the founder's explicit "hasta adına
 * tıklamak" framing. "Randevuyu İptal Et" reuses `updateAppointment`
 * unchanged (via `appointmentStatusUpdatePayload`, same reconstruction
 * `AppointmentEditSheet` already does) — no new Server Action.
 */
function AppointmentAgendaList({
  appointments,
  emptyTitle = "Bugün randevu yok",
  emptyDescription,
  newAppointmentHref,
  linkTarget = "patient",
  patientOptions,
  staffOptions,
}: {
  appointments: AppointmentListRow[]
  emptyTitle?: string
  emptyDescription?: string
  /** Shows a compact "+ Yeni Randevu" action under the empty message when provided. */
  newAppointmentHref?: string
  /**
   * "patient" (default) — every row links to the patient's card. "appointment"
   * — used only by `PatientDetailView`'s own Randevular list, where you're
   * already on the patient and drilling into one specific appointment to
   * edit it is the useful next step. A plain string, not a callback: this is
   * a Client Component now (Sprint 15's ⋮ menu), and a Server Component
   * parent (`PatientDetailView`) can't pass it a function prop across that
   * boundary — passing one crashes every patient page that has appointments.
   */
  linkTarget?: "patient" | "appointment"
  /**
   * Founder feedback 2026-07-31: "Randevuyu Düzenle" used to just navigate
   * to `/appointments/[id]` and make you find the real edit trigger a
   * second time inside "Hızlı İşlemler" there. When both option lists are
   * provided, the row menu instead opens `AppointmentEditSheet` inline —
   * optional/defaulted (not every call site has these lists handy) so the
   * `Link` fallback still works where they're not threaded through.
   */
  patientOptions?: PatientOption[]
  staffOptions?: AssignableStaff[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cancelTarget, setCancelTarget] = useState<AppointmentListRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppointmentListRow | null>(null)
  const [editTarget, setEditTarget] = useState<AppointmentListRow | null>(null)

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const result = await removeAppointment(target.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Randevu silindi.")
      setDeleteTarget(null)
      router.refresh()
    })
  }

  function handleCancel() {
    if (!cancelTarget) return
    const target = cancelTarget
    startTransition(async () => {
      const result = await updateAppointment(target.id, appointmentStatusUpdatePayload(target, "cancelled"))
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Randevu iptal edildi.")
      setCancelTarget(null)
      router.refresh()
    })
  }

  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={emptyTitle}
        description={emptyDescription}
        action={
          newAppointmentHref && (
            <Button size="sm" variant="outline" asChild>
              <Link href={newAppointmentHref}>
                <Plus />
                Yeni Randevu
              </Link>
            </Button>
          )
        }
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {appointments.map((appointment) => {
          const href =
            linkTarget === "appointment" ? `/appointments/${appointment.id}` : `/patients/${appointment.patientId}`
          return (
            <Card key={appointment.id} size="sm" className="transition-shadow duration-150 hover:shadow-md">
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="w-14 shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {new Date(appointment.startsAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(appointment.patientName)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={href} className="w-fit truncate font-medium hover:underline" title={appointment.patientName}>
                    {appointment.patientName}
                  </Link>
                  <span className="truncate text-sm text-muted-foreground">
                    {appointment.staffName} · {formatTurkishPhoneDisplay(appointment.patientPhone)}
                    {appointment.reason ? ` · ${appointment.reason}` : ""}
                  </span>
                </div>
                <AppointmentStatusBadge status={appointment.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Randevu işlemleri">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/patients/${appointment.patientId}`}>
                        <UserRound />
                        Hasta Kartını Aç
                      </Link>
                    </DropdownMenuItem>
                    {patientOptions && staffOptions ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          setEditTarget(appointment)
                        }}
                      >
                        <Pencil />
                        Randevuyu Düzenle
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link href={`/appointments/${appointment.id}`}>
                          <Pencil />
                          Randevuyu Düzenle
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => {
                        event.preventDefault()
                        setCancelTarget(appointment)
                      }}
                    >
                      <CalendarX2 />
                      Randevuyu İptal Et
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => {
                        event.preventDefault()
                        setDeleteTarget(appointment)
                      }}
                    >
                      <Trash2 />
                      Randevuyu Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {editTarget && patientOptions && staffOptions && (
        <AppointmentEditSheet
          appointment={editTarget}
          patientOptions={patientOptions}
          staffOptions={staffOptions}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null)
              router.refresh()
            }
          }}
        />
      )}

      <AlertDialog open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevuyu iptal et</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.patientName} — {cancelTarget && new Date(cancelTarget.startsAt).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}{" "}
              randevusu iptal edilecek. Bu işlem geri alınabilir (randevuyu düzenleyerek).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {isPending ? "İptal ediliyor..." : "Randevuyu İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevuyu sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.patientName} — {deleteTarget && new Date(deleteTarget.startsAt).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}{" "}
              randevusu listeden kaldırılacak. Aktivite geçmişi korunur, kayıt kalıcı olarak silinmez. Hastanın
              randevuyu iptal etmesi durumunda bunun yerine &ldquo;Randevuyu İptal Et&rdquo;i kullanmayı düşünün.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {isPending ? "Siliniyor..." : "Randevuyu Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { AppointmentAgendaList }

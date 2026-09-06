"use client"

import { Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { EditSeriesSheet } from "@/components/treatments/edit-series-sheet"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { updateAppointment } from "@/lib/appointments/actions"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { localDateToDateString } from "@/lib/format/date"
import type { PatientOption } from "@/lib/patients/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { fetchTreatmentSeriesDetail } from "@/lib/treatments/actions"
import type { TreatmentSeriesDetail } from "@/lib/treatments/queries"
import { AppointmentForm } from "./appointment-form"

/**
 * Narrower than `AppointmentDetail`/`AppointmentListRow` — only the fields
 * this Sheet actually reads, so either shape (the appointment detail page's
 * full row, or the agenda list's lighter row) can be passed in directly.
 */
type EditableAppointment = {
  id: string
  patientId: string
  staffId: string
  startsAt: string
  status: AppointmentStatus
  reason: string | null
  linkedTreatment: { seriesId: string } | null
}

function AppointmentEditSheet({
  appointment,
  patientOptions,
  staffOptions,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  appointment: EditableAppointment
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
  /** Overrides the default "Düzenle" button — the appointment detail page's "Hızlı İşlemler" card reuses this exact Sheet with its own trigger. Ignored when `open` is provided (see below). */
  trigger?: ReactNode
  /**
   * External control, for `AppointmentAgendaList`'s row menu: a
   * `SheetTrigger` nested inside a `DropdownMenuItem` is a known-fragile
   * Radix composition (the menu unmounting can race the Sheet opening), so
   * the agenda list instead lifts an `editTarget` row into its own state
   * and renders this Sheet once, externally controlled, exactly like it
   * already does for the cancel/delete `AlertDialog`s. Omit both for the
   * default self-managed (uncontrolled) open state.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen
  const [seriesDetail, setSeriesDetail] = useState<TreatmentSeriesDetail | null>(null)

  const startsAtDate = new Date(appointment.startsAt)
  const time = `${String(startsAtDate.getHours()).padStart(2, "0")}:${String(startsAtDate.getMinutes()).padStart(2, "0")}`

  // Founder decision 2026-07-31 — editing a linked treatment's package-level
  // fields (İşlem/Seans/Ücret) shouldn't require leaving the appointment
  // edit panel and going back to the patient card. Fetched only while the
  // Sheet is open, reusing `EditSeriesSheet` as-is (no parallel edit path)
  // rather than duplicating its form fields/validation here.
  useEffect(() => {
    if (!open || !appointment.linkedTreatment) return
    let cancelled = false
    fetchTreatmentSeriesDetail(appointment.linkedTreatment.seriesId).then((detail) => {
      if (!cancelled) setSeriesDetail(detail)
    })
    return () => {
      cancelled = true
    }
  }, [open, appointment.linkedTreatment])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger asChild>
          {trigger ?? (
            <Button variant="outline">
              <Pencil />
              Düzenle
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Randevuyu Düzenle</SheetTitle>
          <SheetDescription>
            Bilgileri güncelleyin. Değişiklikler aktivite geçmişine kaydedilir.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          {seriesDetail && (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Bağlı Tedavi</p>
                <p className="truncate text-sm font-medium">
                  {seriesDetail.treatmentType} ({seriesDetail.completedSessions}/{seriesDetail.totalSessions} Seans)
                </p>
              </div>
              <EditSeriesSheet
                seriesId={seriesDetail.id}
                treatmentType={seriesDetail.treatmentType}
                totalSessions={seriesDetail.totalSessions}
                totalFee={seriesDetail.totalFee}
                onSuccess={() => router.refresh()}
              />
            </div>
          )}
          <AppointmentForm
            mode="edit"
            defaultValues={{
              patientId: appointment.patientId,
              staffId: appointment.staffId,
              date: localDateToDateString(startsAtDate),
              time,
              status: appointment.status,
              reason: appointment.reason ?? "",
              note: "",
            }}
            patientOptions={patientOptions}
            staffOptions={staffOptions}
            onSubmit={(values) => updateAppointment(appointment.id, values)}
            onSuccess={() => setOpen(false)}
            submitLabel="Kaydet"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { AppointmentEditSheet }

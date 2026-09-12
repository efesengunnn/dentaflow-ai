import { Download, Plus } from "lucide-react"
import Link from "next/link"

import { AppointmentCalendar } from "@/components/appointments/calendar/appointment-calendar"
import {
  getMonthGridRange,
  getWeekRange,
  parseAnchor,
  resolveSelectedDay,
} from "@/components/appointments/calendar/calendar-utils"
import { AppointmentFilters } from "@/components/appointments/appointment-filters"
import { AppointmentImportDialog } from "@/components/appointments/appointment-import-dialog"
import { AppointmentTableSection } from "@/components/appointments/appointment-table-section"
import { TodaysAppointmentsCard } from "@/components/dashboard/todays-appointments-card"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  getAppointments,
  getAppointmentsForCalendarRange,
  getControlEntriesForCalendarRange,
} from "@/lib/appointments/queries"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getTodaysAppointments, type DashboardAppointmentRow } from "@/lib/dashboard/queries"
import { localDateToDateString } from "@/lib/format/date"
import { getPatientOptions } from "@/lib/patients/queries"
import { getAssignableStaff } from "@/lib/staff/queries"

type AppointmentView = "list" | "calendar" | "today"
type CalendarMode = "month" | "week"

type AppointmentsPageProps = {
  searchParams: Promise<{
    view?: string
    mode?: string
    anchor?: string
    day?: string
    search?: string
    status?: string
    staffId?: string
    page?: string
  }>
}

function viewHref(view: AppointmentView): string {
  return `/appointments?view=${view}`
}

/**
 * Three view modes (Liste/Takvim/Bugün), all URL-driven (`?view=`), same
 * bookmarkable-real-state philosophy as `/settings`'s nested routes — never
 * a client-only Tabs component holding the active view in memory. Default
 * is `calendar` (Month) — opening a scheduling module to a calendar is the
 * standard convention; List and Today are switchable alongside it.
 */
export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const params = await searchParams
  const view: AppointmentView =
    params.view === "list" || params.view === "today" ? params.view : "calendar"
  const mode: CalendarMode = params.mode === "week" ? "week" : "month"

  const staffOptions = await getAssignableStaff()

  return (
    <PageContainer>
      <PageHeader
        title="Randevular"
        description="Klinik takvimini ve randevu listesini buradan yönetin."
        actions={
          <div className="flex items-center gap-2">
            <AppointmentImportDialog />
            <Button asChild>
              <Link href="/appointments/new">
                <Plus />
                Yeni Randevu
              </Link>
            </Button>
          </div>
        }
      />

      <div className="bg-muted/50 inline-flex w-fit gap-1 rounded-xl border p-1">
        <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" asChild>
          <Link href={viewHref("calendar")}>Takvim</Link>
        </Button>
        <Button variant={view === "list" ? "default" : "ghost"} size="sm" asChild>
          <Link href={viewHref("list")}>Liste</Link>
        </Button>
        <Button variant={view === "today" ? "default" : "ghost"} size="sm" asChild>
          <Link href={viewHref("today")}>Bugün</Link>
        </Button>
      </div>

      {view === "calendar" && (
        <CalendarViewSection anchorParam={params.anchor} dayParam={params.day} mode={mode} staffOptions={staffOptions} />
      )}

      {view === "today" && <TodayViewSection />}

      {view === "list" && (
        <ListViewSection
          search={params.search}
          status={params.status}
          staffId={params.staffId}
          page={params.page}
          staffOptions={staffOptions}
        />
      )}
    </PageContainer>
  )
}

async function CalendarViewSection({
  anchorParam,
  dayParam,
  mode,
  staffOptions,
}: {
  anchorParam: string | undefined
  dayParam: string | undefined
  mode: CalendarMode
  staffOptions: Awaited<ReturnType<typeof getAssignableStaff>>
}) {
  const anchor = parseAnchor(anchorParam)
  const range = mode === "month" ? getMonthGridRange(anchor) : getWeekRange(anchor)
  const selectedDay = resolveSelectedDay(dayParam, range)
  const [rows, controlEntries, patientOptions, staffMember] = await Promise.all([
    getAppointmentsForCalendarRange(localDateToDateString(range.start), localDateToDateString(range.end)),
    getControlEntriesForCalendarRange(localDateToDateString(range.start), localDateToDateString(range.end)),
    getPatientOptions(),
    getCurrentStaffMember(),
  ])
  const canManagePayments =
    staffMember?.role === "owner" || staffMember?.role === "secretary" || staffMember?.role === "beauty_specialist"

  return (
    <AppointmentCalendar
      mode={mode}
      anchor={anchor}
      range={range}
      rows={rows}
      controlEntries={controlEntries}
      selectedDay={selectedDay}
      patientOptions={patientOptions}
      staffOptions={staffOptions}
      canManagePayments={canManagePayments}
    />
  )
}

/**
 * Sprint 25 (Project Rebirth) — a 10-angle design audit's clinical-workflow
 * research made the case explicitly: "Bugün" is the one screen in Randevular
 * that isn't a calendar or a record table — it's "run the floor right now,"
 * and a flat chronological list doesn't answer a front-desk secretary's real
 * question ("who's waiting on which doctor"). This groups the exact same
 * `getTodaysAppointments()` rows by `staffId` — a field every row already
 * carries, no new query — into one `TodaysAppointmentsCard` per staff
 * member, busiest first, so doctor workload is visible as column order/
 * count instead of buried in a `staffName` sub-label on every row. Each
 * column still reuses `TodaysAppointmentsCard` completely unmodified
 * (same Geldi/Tamamlandı/Tahsilat actions, same internal queue-priority
 * sort) — zero duplicated interactive logic, zero new Server Actions.
 *
 * The real `AppointmentStatus` enum has no "in progress" state — only
 * `scheduled`/`confirmed`/`completed`/`cancelled`/`no_show` — so this
 * doesn't invent a fake "with the doctor now" column; `confirmed` already
 * reads as "arrived" per `TodaysAppointmentsCard`'s own Sprint 24 queue
 * ranking, and that's as far as the data honestly goes.
 *
 * A single-doctor day collapses to one column — same as the previous
 * flat-list shape, so nothing gets worse for a one-doctor clinic; the
 * grouping only starts doing real work once there's more than one staff
 * member seeing patients today.
 */
async function TodayViewSection() {
  const [rows, staffMember] = await Promise.all([getTodaysAppointments(), getCurrentStaffMember()])
  const canManagePayments =
    staffMember?.role === "owner" || staffMember?.role === "secretary" || staffMember?.role === "beauty_specialist"

  if (rows.length === 0) {
    return <TodaysAppointmentsCard appointments={rows} canManagePayments={canManagePayments} />
  }

  const byStaff = new Map<string, { staffName: string; rows: DashboardAppointmentRow[] }>()
  for (const row of rows) {
    const group = byStaff.get(row.staffId)
    if (group) {
      group.rows.push(row)
    } else {
      byStaff.set(row.staffId, { staffName: row.staffName, rows: [row] })
    }
  }
  const staffGroups = Array.from(byStaff.entries()).sort(([, a], [, b]) => b.rows.length - a.rows.length)

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {staffGroups.map(([staffId, group]) => (
        <TodaysAppointmentsCard
          key={staffId}
          title={`${group.staffName} · ${group.rows.length}`}
          appointments={group.rows}
          canManagePayments={canManagePayments}
        />
      ))}
    </div>
  )
}

async function ListViewSection({
  search,
  status,
  staffId,
  page: pageParam,
  staffOptions,
}: {
  search: string | undefined
  status: string | undefined
  staffId: string | undefined
  page: string | undefined
  staffOptions: Awaited<ReturnType<typeof getAssignableStaff>>
}) {
  const page = pageParam ? Number.parseInt(pageParam, 10) || 1 : 1
  const { rows, total, pageSize } = await getAppointments({
    search,
    status: status as AppointmentStatus | undefined,
    staffId,
    page,
  })

  const exportParams = new URLSearchParams()
  if (search) exportParams.set("search", search)
  if (status) exportParams.set("status", status)
  if (staffId) exportParams.set("staffId", staffId)
  const exportHref = `/appointments/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AppointmentFilters staffOptions={staffOptions} />
        <Button variant="outline" asChild>
          <a href={exportHref}>
            <Download />
            Dışa Aktar
          </a>
        </Button>
      </div>
      <AppointmentTableSection rows={rows} total={total} page={page} pageSize={pageSize} />
    </div>
  )
}

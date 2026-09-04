import { Download, Plus } from "lucide-react"
import Link from "next/link"

import { AppointmentCalendar } from "@/components/appointments/calendar/appointment-calendar"
import {
  getMonthGridRange,
  getWeekRange,
  parseAnchor,
  resolveSelectedDay,
} from "@/components/appointments/calendar/calendar-utils"
import { AppointmentAgendaList } from "@/components/appointments/appointment-agenda-list"
import { AppointmentFilters } from "@/components/appointments/appointment-filters"
import { AppointmentImportDialog } from "@/components/appointments/appointment-import-dialog"
import { AppointmentTableSection } from "@/components/appointments/appointment-table-section"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { PageSection } from "@/components/shared/page-section"
import { Button } from "@/components/ui/button"
import {
  getAppointments,
  getAppointmentsForCalendarRange,
  type AppointmentListRow,
} from "@/lib/appointments/queries"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { localDateToDateString } from "@/lib/format/date"
import { getPatientOptions, type PatientOption } from "@/lib/patients/queries"
import { getAssignableStaff, type AssignableStaff } from "@/lib/staff/queries"

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

function nextDayDateString(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return localDateToDateString(date)
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

  const [staffOptions, patientOptions] = await Promise.all([getAssignableStaff(), getPatientOptions()])

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

      {view === "today" && <TodayViewSection patientOptions={patientOptions} staffOptions={staffOptions} />}

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
  const [rows, patientOptions] = await Promise.all([
    getAppointmentsForCalendarRange(localDateToDateString(range.start), localDateToDateString(range.end)),
    getPatientOptions(),
  ])

  return (
    <AppointmentCalendar
      mode={mode}
      anchor={anchor}
      range={range}
      rows={rows}
      selectedDay={selectedDay}
      patientOptions={patientOptions}
      staffOptions={staffOptions}
    />
  )
}

/**
 * "Bugün" is the one screen in Randevular that isn't a calendar or a record
 * table — it's "run the floor right now." Groups today's appointments by
 * `staffId` (a field every row already carries, no new query) into one
 * agenda list per staff member, busiest first, so doctor workload is
 * visible as column order/count instead of buried in a `staffName`
 * sub-label on every row. A single-doctor day collapses to one column.
 */
async function TodayViewSection({
  patientOptions,
  staffOptions,
}: {
  patientOptions: PatientOption[]
  staffOptions: AssignableStaff[]
}) {
  const todayStart = localDateToDateString(new Date())
  const rows = await getAppointmentsForCalendarRange(todayStart, nextDayDateString(todayStart))

  const byStaff = new Map<string, { staffName: string; rows: AppointmentListRow[] }>()
  for (const row of rows) {
    const group = byStaff.get(row.staffId)
    if (group) {
      group.rows.push(row)
    } else {
      byStaff.set(row.staffId, { staffName: row.staffName, rows: [row] })
    }
  }
  const staffGroups = Array.from(byStaff.entries()).sort(([, a], [, b]) => b.rows.length - a.rows.length)

  if (staffGroups.length === 0) {
    return (
      <AppointmentAgendaList
        appointments={[]}
        emptyTitle="Bugün randevu yok"
        patientOptions={patientOptions}
        staffOptions={staffOptions}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {staffGroups.map(([staffId, group]) => (
        <PageSection key={staffId} title={`${group.staffName} · ${group.rows.length}`}>
          <AppointmentAgendaList
            appointments={group.rows}
            emptyTitle="Bugün randevu yok"
            patientOptions={patientOptions}
            staffOptions={staffOptions}
          />
        </PageSection>
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

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarClock, CalendarCheck2, ClipboardCheck, History, Wallet } from "lucide-react"

import { AIAlertsCard } from "@/components/dashboard/ai-alerts-card"
import { DashboardActivityFeed } from "@/components/dashboard/dashboard-activity-feed"
import { FinancialSummaryCards } from "@/components/dashboard/financial-summary-cards"
import { RecentListCard, type RecentListItem } from "@/components/dashboard/recent-list-card"
import { StatCard } from "@/components/dashboard/stat-card"
import { TodaysAppointmentsCard } from "@/components/dashboard/todays-appointments-card"
import { PageContainer } from "@/components/shared/page-container"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import {
  getFinancialOverview,
  getOwnOperationalStats,
  getRecentActivities,
  getTodaysAppointments,
  getUpcomingAppointments,
  type DashboardAppointmentRow,
} from "@/lib/dashboard/queries"
import { currentStaffHasPermission } from "@/lib/permissions/queries"
import { getAssignableStaff } from "@/lib/staff/queries"
// Sprint 28D — the Dashboard's own "AI Uyarıları" card now reads from the
// new Treatment Plan model, same as the chat panel's `getFollowUpCandidates`
// tool (see `lib/ai/tools.ts`).
import { getFollowUpCandidatesForAI } from "@/lib/treatment-plans/queries"

function toAppointmentListItems(
  appointments: DashboardAppointmentRow[],
  metaFormat: "time" | "date",
): RecentListItem[] {
  return appointments.map((appointment) => ({
    id: appointment.id,
    title: appointment.patientName,
    subtitle: appointment.staffName,
    href: `/appointments/${appointment.id}`,
    meta:
      metaFormat === "time"
        ? format(new Date(appointment.startsAt), "HH:mm")
        : format(new Date(appointment.startsAt), "d MMM, HH:mm", { locale: tr }),
  }))
}

/** "Günaydın" before noon, "İyi günler" through the afternoon/evening, "İyi akşamlar" at night — a small human touch for the one greeting a staff member sees once a day. */
function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Günaydın"
  if (hour < 18) return "İyi günler"
  return "İyi akşamlar"
}

export default async function DashboardPage() {
  const [recentActivities, todaysAppointments, upcomingAppointments, staffMember, followUpCandidates] =
    await Promise.all([
      getRecentActivities(),
      getTodaysAppointments(),
      getUpcomingAppointments(),
      getCurrentStaffMember(),
      getFollowUpCandidatesForAI(),
    ])

  const hasFinancialAccess = staffMember ? await currentStaffHasPermission("financial_access") : false
  const canManagePayments =
    staffMember?.role === "owner" || staffMember?.role === "secretary" || staffMember?.role === "beauty_specialist"
  // Founder decision 2026-07-28 — same rule as the patient card's own
  // correction/edit gates (see `patients/[id]/page.tsx`): correcting a
  // payment stays owner/secretary-only, while voiding a package follows the
  // RLS role set that can already edit one (everyone but secretary).
  const canCorrectPayments = staffMember?.role === "owner" || staffMember?.role === "secretary"
  const canManageTreatments = staffMember?.role !== "secretary"

  const [financialOverview, ownStats, staffOptions] = await Promise.all([
    hasFinancialAccess ? getFinancialOverview() : Promise.resolve(null),
    hasFinancialAccess ? Promise.resolve(null) : getOwnOperationalStats(),
    hasFinancialAccess ? getAssignableStaff() : Promise.resolve([]),
  ])

  // Sprint 21 — hero greeting + a one-line "what does today actually look
  // like" summary, entirely derived from data already fetched above (no new
  // query): appointment count + how many of today's appointments still have
  // a balance due, per the founder's "günün özeti çok daha güçlü bir
  // hiyerarşiyle sunulsun" brief.
  const now = new Date()
  // Skip title prefixes ("Dr.", "Prof. Dr.", ...) — anything ending in "."
  // — so the greeting addresses the person, not their title.
  const firstName = staffMember?.fullName?.split(" ").find((part) => !part.endsWith(".")) ?? ""
  const pendingPaymentCount = todaysAppointments.filter(
    (appointment) =>
      appointment.linkedTreatment?.remainingBalance !== null &&
      (appointment.linkedTreatment?.remainingBalance ?? 0) > 0,
  ).length

  // Sprint 24 — the hero's "N tahsilat bekliyor" chip is today-only while
  // "Bekleyen Bakiye" below is an all-time, clinic-wide figure; the design
  // audit flagged these as easy to conflate since they share vocabulary and
  // used to sit far apart on the page. Cross-referencing by `patientId` (both
  // already fetched, no new query) lets the money card say how many of
  // today's patients it actually covers.
  const todaysPatientIds = new Set(todaysAppointments.map((appointment) => appointment.patientId))
  const todaysOutstandingPatientCount = financialOverview
    ? new Set(
        financialOverview.outstandingBalanceDetail
          .filter((row) => todaysPatientIds.has(row.patientId))
          .map((row) => row.patientId),
      ).size
    : 0

  return (
    <PageContainer>
      {/* Sprint 22 — the hero's "wow" comes from three cheap, purely
          decorative layers stacked on data we already had: a soft blurred
          glow (depth, without a literal image asset), a bigger/bolder
          greeting, and the day's two key facts promoted from a plain
          sentence into standalone stat chips — same numbers as Sprint 21's
          `summaryParts` line, just given real visual weight instead of
          being buried in a sentence.

          Deliberately no `overflow-hidden` on this outer div — Sprint 21
          found this exact container silently clips its own last child's
          height in this environment (confirmed again in Sprint 22 when
          re-adding it for the glow circle made the chip row invisible,
          root-caused via getBoundingClientRect: the div's own auto height
          came in shorter than its content). The glow circle is already
          `rounded-full`, so it doesn't need a clipping parent to look
          right — worst case it bleeds a few px past the card's rounded
          corner, which is a far smaller cost than silently hiding content. */}
      <div className="relative rounded-2xl bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-6 py-8 sm:px-8 sm:py-10">
        <div
          className="bg-primary/10 absolute -top-20 -right-20 size-64 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-primary text-sm font-semibold capitalize">
            {format(now, "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {timeOfDayGreeting(now.getHours())}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="bg-card/80 ring-foreground/5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-xs ring-1">
              <CalendarCheck2 className="text-primary size-4" />
              {todaysAppointments.length > 0
                ? `Bugün ${todaysAppointments.length} randevunuz var`
                : "Bugün için planlanmış randevu yok"}
            </div>
            {pendingPaymentCount > 0 && (
              <div className="bg-card/80 ring-foreground/5 text-warning inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-xs ring-1">
                <Wallet className="size-4" />
                {pendingPaymentCount} tahsilat bekliyor
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sprint 24 (Project Evolution) — the page now reads as one story
          instead of a stack of independently-placed blocks, per a 5-angle
          design audit (Product UX / IA / Dashboard-narrative / Clinical-
          workflow / Premium-SaaS-layout). The audit's strongest, most
          repeated finding: "Bugünkü Randevular" — the one block every role
          actually acts on — used to load third, after two blocks (money,
          an AI stub) that are context, not action. The story now runs
          "here's your day → here's what needs you right now → here's the
          money context behind that → here's what's coming after today →
          here's what's ahead for the product," matching how an owner or
          secretary actually reads the page top to bottom. Nothing here
          moved because it looks better — every reordering below is a
          reordering, not a restyle. */}
      <TodaysAppointmentsCard
        appointments={todaysAppointments}
        canManagePayments={canManagePayments}
        viewAllHref="/appointments?view=today"
      />

      {/* The financial picture now follows the operational one instead of
          leading it — money is the context for the day just shown, not the
          first thing anyone has to read past to get to their actual work.
          `outstandingBalance` is an all-time, clinic-wide figure while the
          hero's "N tahsilat bekliyor" chip is today-only — the audit
          flagged these as easy to conflate since they share vocabulary and
          used to sit far apart; the hint text below now says which is
          which, using data already fetched (`outstandingBalanceDetail`
          already carries `patientId`, cross-referenced against
          `todaysAppointments` — no new query). */}
      {financialOverview ? (
        <FinancialSummaryCards
          monthlyRevenue={financialOverview.monthlyRevenue}
          outstandingBalance={financialOverview.outstandingBalance}
          revenueDetail={financialOverview.revenueDetail}
          outstandingBalanceDetail={financialOverview.outstandingBalanceDetail}
          staffOptions={staffOptions}
          canManagePayments={canManagePayments}
          canCorrectPayments={canCorrectPayments}
          canManageTreatments={canManageTreatments}
          outstandingBalanceHint={
            todaysOutstandingPatientCount > 0
              ? `Tüm zamanlar toplamı — bugün randevulu ${todaysOutstandingPatientCount} hastayı kapsar`
              : "Tüm aktif ve tamamlanan tedavilerin kalan bakiyesi"
          }
        />
      ) : ownStats ? (
        // A lone stat inside a `sm:grid-cols-3` left two empty cells on
        // desktop for staff without financial access (Sprint 21/22 bug,
        // never noticed because financial-access accounts always exercised
        // this path) — constrained to its own natural width instead.
        <div className="max-w-xs">
          <StatCard label={ownStats.label} value={ownStats.value.toLocaleString("tr-TR")} icon={ClipboardCheck} />
        </div>
      ) : null}

      {/* Sprint 23 — Yaklaşan Randevular and Son Aktiviteler are both
          secondary/retrospective information of similar weight, previously
          two full-width stacked sections; side by side they read as one
          "activity" zone and the page ends sooner. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentListCard
          title="Yaklaşan Randevular"
          icon={CalendarClock}
          items={toAppointmentListItems(upcomingAppointments, "date")}
          viewAllHref="/appointments"
          emptyTitle="Yaklaşan randevu yok"
          emptyDescription="Yeni bir randevu oluşturduğunuzda burada görünmeye başlayacak."
        />
        <div className="border-border flex h-full flex-col gap-4 border-t pt-5">
          <div className="flex items-center gap-2">
            <History className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <h3 className="text-base font-semibold tracking-tight">Son Aktiviteler</h3>
          </div>
          <DashboardActivityFeed activities={recentActivities} />
        </div>
      </div>

      {/* Sprint 27 — AI Uyarıları closes the story, same position the
          Sprint 24 static teaser held ("here's what's coming next" after
          the day's actual content). Real data now, not a "coming soon"
          placeholder — see AIAlertsCard for why this stays a deterministic
          query, not an LLM call. */}
      <AIAlertsCard candidates={followUpCandidates} />
    </PageContainer>
  )
}

import { CalendarClock, ClipboardList } from "lucide-react"

import { AIInsightsCard } from "@/components/shared/ai-insights-card"
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { PageSection } from "@/components/shared/page-section"
import { PlaceholderCard } from "@/components/shared/placeholder-card"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { LeadActivityRow, LeadDetail } from "@/lib/leads/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { LeadActivityTimeline } from "./lead-activity-timeline"
import { LeadConvertButton } from "./lead-convert-button"
import { LeadDeleteDialog } from "./lead-delete-dialog"
import { LeadEditSheet } from "./lead-edit-sheet"
import { LeadInfoPanel } from "./lead-info-panel"

function LeadDetailView({
  lead,
  activities,
  staffOptions,
  canManage,
}: {
  lead: LeadDetail
  activities: LeadActivityRow[]
  staffOptions: AssignableStaff[]
  canManage: boolean
}) {
  return (
    <PageContainer>
      <BreadcrumbLabel value={lead.fullName} />
      <PageHeader
        title={lead.fullName}
        description={formatTurkishPhoneDisplay(lead.phone)}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              {lead.status !== "converted" && (
                <LeadConvertButton leadId={lead.id} leadName={lead.fullName} />
              )}
              <LeadEditSheet lead={lead} staffOptions={staffOptions} />
              <LeadDeleteDialog leadId={lead.id} leadName={lead.fullName} />
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <LeadInfoPanel lead={lead} />

        <div className="flex flex-col gap-8">
          <PageSection title="Aktivite Geçmişi">
            <LeadActivityTimeline
              leadId={lead.id}
              activities={activities}
              canAddNote={canManage}
            />
          </PageSection>

          <PageSection title="Yaklaşan Görevler">
            <PlaceholderCard
              icon={ClipboardList}
              text="Görev yönetimi henüz aktif değil — yakında bu bölümden takip görevleri oluşturabileceksiniz."
            />
          </PageSection>

          <PageSection title="Yaklaşan Randevular">
            <PlaceholderCard
              icon={CalendarClock}
              text="Randevu modülü henüz aktif değil — bu kayda bağlı randevular burada listelenecek."
            />
          </PageSection>

          <PageSection title="AI Insights">
            <AIInsightsCard />
          </PageSection>
        </div>
      </div>
    </PageContainer>
  )
}

export { LeadDetailView }

import { notFound } from "next/navigation"

import { LeadDetailView } from "@/components/leads/lead-detail-view"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { getLeadActivities, getLeadById } from "@/lib/leads/queries"
import { getAssignableStaff } from "@/lib/staff/queries"

type LeadDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params

  // All four are independent round trips (activities/staffOptions don't
  // depend on whether `lead` exists) — run together instead of two
  // sequential Promise.all batches to cut a full round trip off the common
  // case where the lead is found.
  const [lead, staffMember, activities, staffOptions] = await Promise.all([
    getLeadById(id),
    getCurrentStaffMember(),
    getLeadActivities(id),
    getAssignableStaff(),
  ])

  if (!lead) {
    notFound()
  }

  const canManage = staffMember?.role !== "doctor"

  return (
    <LeadDetailView
      lead={lead}
      activities={activities}
      staffOptions={staffOptions}
      canManage={canManage}
    />
  )
}

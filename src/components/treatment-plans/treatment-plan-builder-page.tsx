"use client"

import { useRouter } from "next/navigation"

import type { AssignableStaff } from "@/lib/staff/queries"
import { TreatmentPlanBuilder } from "./treatment-plan-builder"

/**
 * Founder feedback (2026-08-11, Sprint 30 follow-up) — the treatment-plan
 * builder needs its own always-available full-page entry point on the
 * patient card ("Tedavi Planı Ekle"), separate from "Randevu Oluştur" (which
 * only offers it inline when the patient has zero remaining-session items).
 * A real page navigation, not a Sheet — same "opens like a page, not a side
 * panel" requirement that also took "Randevu Oluştur" back to
 * `/appointments/new`. Just a thin client wrapper: `TreatmentPlanBuilder`
 * itself is unchanged, only what happens after `onCreated` differs (redirect
 * back to the patient card instead of refreshing an inline picker).
 */
function TreatmentPlanBuilderPage({
  patientId,
  staffOptions,
  isOwner,
}: {
  patientId: string
  staffOptions: AssignableStaff[]
  isOwner: boolean
}) {
  const router = useRouter()

  return (
    <TreatmentPlanBuilder
      patientId={patientId}
      staffOptions={staffOptions}
      isOwner={isOwner}
      onCreated={() => {
        router.push(`/patients/${patientId}`)
        router.refresh()
      }}
    />
  )
}

export { TreatmentPlanBuilderPage }

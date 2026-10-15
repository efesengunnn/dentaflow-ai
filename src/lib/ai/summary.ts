import { nowInIstanbul } from "@/lib/format/date"
import { formatToothList } from "@/lib/odontogram/fdi"
import {
  PERIODIC_CHECKUP_DAYS,
  collectCompletedTeeth,
  resolveFollowUpDueDate,
} from "@/lib/treatment-plans/constants"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"

export type PatientTreatmentSummary = {
  lastTreatment: { treatmentName: string; date: string; toothNumbers: number[] } | null
  pendingTreatments: { treatmentName: string; remainingToothNumbers: number[] }[]
  suggestedControl: { treatmentName: string; dueDate: string; isEstimate: boolean } | null
  /** Short Turkish notes for staff, most urgent first — empty when nothing needs attention. */
  attentionNotes: string[]
}

/**
 * A patient's dental treatment picture (2026-10-14), derived purely from the
 * treatment plans the patient card already loads — no extra query. Shared by
 * the patient card's "AI Özet" box and the chat panel's `getPatientSummary`
 * tool so both say the same thing. Same rules as the Dashboard alerts
 * (`getFollowUpCandidatesForAI`): nothing is flagged while the patient has an
 * upcoming appointment.
 */
export function summarizePatientTreatments(
  plans: TreatmentPlanDetail[],
  visits: { hasUpcomingAppointment: boolean; lastAppointmentAt: string | null },
): PatientTreatmentSummary {
  const today = nowInIstanbul().toISOString().slice(0, 10)
  const livePlans = plans.filter((plan) => plan.status !== "voided" && plan.status !== "cancelled")

  let lastTreatment: PatientTreatmentSummary["lastTreatment"] = null
  let suggestedControl: PatientTreatmentSummary["suggestedControl"] = null
  let suggestedFromDate = ""
  const pendingTreatments: PatientTreatmentSummary["pendingTreatments"] = []

  for (const plan of livePlans) {
    for (const item of plan.items) {
      const completedSessions = item.sessions.filter((session) => session.status === "completed")
      const latest = completedSessions.reduce<(typeof completedSessions)[number] | null>(
        (best, session) => (!best || session.performedAt > best.performedAt ? session : best),
        null,
      )

      if (latest) {
        if (!lastTreatment || latest.performedAt > lastTreatment.date) {
          lastTreatment = { treatmentName: item.treatmentName, date: latest.performedAt, toothNumbers: latest.toothNumbers ?? [] }
        }
        const due = resolveFollowUpDueDate({
          treatmentName: item.treatmentName,
          lastCompletedAt: latest.performedAt,
          completionControlDate: latest.controlDate,
          itemControlDate: item.controlDate,
        })
        // The most recently treated item with a follow-up drives the suggestion.
        if (due && latest.performedAt > suggestedFromDate) {
          suggestedControl = { treatmentName: item.treatmentName, ...due }
          suggestedFromDate = latest.performedAt
        }
      }

      if (item.status === "active" && plan.status === "active") {
        const completed = collectCompletedTeeth(item.status, item.toothNumbers, item.completions)
        pendingTreatments.push({
          treatmentName: item.treatmentName,
          remainingToothNumbers: item.toothNumbers.filter((tooth) => !completed.includes(tooth)),
        })
      }
    }
  }

  const attentionNotes: string[] = []
  if (!visits.hasUpcomingAppointment) {
    // A plain visit (muayene) after the last treatment also counts as "seen".
    const lastAppointmentDay = visits.lastAppointmentAt
      ? new Date(Date.parse(visits.lastAppointmentAt) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : ""
    const visitedSinceSuggestion = lastAppointmentDay > suggestedFromDate.slice(0, 10)

    if (pendingTreatments.length > 0) {
      attentionNotes.push("Tamamlanmamış tedavisi var, randevusu yok.")
    }
    if (suggestedControl && suggestedControl.dueDate <= today && !visitedSinceSuggestion) {
      attentionNotes.push(`${suggestedControl.treatmentName} kontrolü zamanı geldi.`)
    }
    if (lastTreatment) {
      const lastSeen = [lastTreatment.date.slice(0, 10), lastAppointmentDay].sort().at(-1) ?? today
      const days = Math.floor((Date.parse(today) - Date.parse(lastSeen)) / (24 * 60 * 60 * 1000))
      if (days >= PERIODIC_CHECKUP_DAYS) attentionNotes.push("6 aydır gelmedi, periyodik kontrol zamanı.")
    }
  }

  return { lastTreatment, pendingTreatments, suggestedControl, attentionNotes }
}

/** "Dolgu (Diş 16, 17)" — a pending treatment as one short phrase. */
export function describePendingTreatment(treatment: { treatmentName: string; remainingToothNumbers: number[] }): string {
  return treatment.remainingToothNumbers.length > 0
    ? `${treatment.treatmentName} (Diş ${formatToothList(treatment.remainingToothNumbers)})`
    : treatment.treatmentName
}

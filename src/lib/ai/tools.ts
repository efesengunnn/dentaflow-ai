import { tool } from "ai"
import { z } from "zod"

import {
  getClinicPackageStatusForAI,
  getNewPatientStatsForAI,
  getPatientPackageStatusForAI,
  getPatientSummaryForAI,
  getTodayAppointmentsForAI,
  getUpcomingAppointmentsForAI,
  searchPatientsByName,
} from "@/lib/ai/queries"
// Sprint 28D — follow-up candidates now come from the new Treatment Plan
// model (treatment_plan_items/treatment_sessions) exclusively; the other
// tools above stay on the legacy queries, unchanged, out of this sprint's
// scope.
import { getFollowUpCandidatesForAI } from "@/lib/treatment-plans/queries"

/**
 * Shared per-tool context — the authenticated caller's identity, resolved
 * server-side in the Route Handler and threaded in via `toolsContext`
 * (never model-provided input). This is the enforcement point for the AI
 * Data Access Principle (docs/ARCHITECTURE.md): RLS alone would let every
 * role read Tier-1 financial rows, so `hasFinancialAccess` is checked again
 * here, inside each tool, before any ₺ figure is returned.
 */
const aiToolContextSchema = z.object({
  staffId: z.string(),
  clinicId: z.string(),
  role: z.string(),
  hasFinancialAccess: z.boolean(),
})

async function resolveSinglePatient(patientName: string) {
  const matches = await searchPatientsByName(patientName)
  if (matches.length === 0) return { status: "not_found" as const }
  if (matches.length > 1) return { status: "ambiguous" as const, matches }
  return { status: "found" as const, patient: matches[0] }
}

export const aiTools = {
  getTodayAppointments: tool({
    description: "Bugünkü randevuların listesini getirir (hasta adı, personel, saat, durum). Finansal bilgi içermez.",
    inputSchema: z.object({}),
    contextSchema: aiToolContextSchema,
    execute: async () => getTodayAppointmentsForAI(),
  }),

  getUpcomingAppointments: tool({
    description: "Bugünden sonraki yaklaşan randevuların listesini getirir. Finansal bilgi içermez.",
    inputSchema: z.object({}),
    contextSchema: aiToolContextSchema,
    execute: async () => getUpcomingAppointmentsForAI(),
  }),

  getPatientSummary: tool({
    description:
      "Belirli bir hastanın özetini getirir: son işlem tarihi/türü, önerilen kontrol tarihi, aktif paket sayısı ve kalan seans sayısı. Finansal erişimi olmayan kullanıcılar için bakiye bilgisi döndürülmez.",
    inputSchema: z.object({ patientName: z.string().describe("Hastanın adı soyadı") }),
    contextSchema: aiToolContextSchema,
    execute: async ({ patientName }, { context }) => {
      const resolved = await resolveSinglePatient(patientName)
      if (resolved.status !== "found") return resolved
      const summary = await getPatientSummaryForAI(resolved.patient.id, context.hasFinancialAccess)
      return summary ?? { status: "not_found" as const }
    },
  }),

  getPackageStatus: tool({
    description:
      "Paket durumunu getirir. Bir hasta adı verilirse o hastanın paketlerini (kalan seans, finansal erişim varsa bakiye), verilmezse kliniğin genelindeki aktif paket sayısını ve bitmek üzere olan paket sayısını döndürür.",
    inputSchema: z.object({
      patientName: z.string().optional().describe("Belirtilirse yalnızca bu hastanın paketleri getirilir"),
    }),
    contextSchema: aiToolContextSchema,
    execute: async ({ patientName }, { context }) => {
      if (!patientName) return getClinicPackageStatusForAI()
      const resolved = await resolveSinglePatient(patientName)
      if (resolved.status !== "found") return resolved
      const status = await getPatientPackageStatusForAI(resolved.patient.id, context.hasFinancialAccess)
      return status ?? { status: "not_found" as const }
    },
  }),

  getNewPatientStats: tool({
    description:
      "Bu ay eklenen yeni hasta sayısını getirir. Yalnızca finansal erişimi olan kullanıcılar (klinik sahibi/yetkili) için kullanılabilir.",
    inputSchema: z.object({}),
    contextSchema: aiToolContextSchema,
    execute: async (_input, { context }) => {
      const count = await getNewPatientStatsForAI(context.hasFinancialAccess)
      return count === null ? { status: "not_authorized" as const } : { count }
    },
  }),

  getFollowUpCandidates: tool({
    description:
      "Takip gereken hastaları tespit eder: Botoks (150 gün), PRP/Mezoterapi (30 gün) kontrolü yaklaşanlar, tedavi planında 1 seans kalanlar, 30+ gündür gelmeyen aktif hastalar. Yalnızca isim ve tarih içerir, finansal bilgi içermez.",
    inputSchema: z.object({}),
    contextSchema: aiToolContextSchema,
    execute: async () => getFollowUpCandidatesForAI(),
  }),
}

import { tool } from "ai"
import { z } from "zod"

import {
  getActiveTreatmentPlanCountForAI,
  getNewPatientStatsForAI,
  getPatientSummaryForAI,
  getPatientTreatmentPlansForAI,
  getTodayAppointmentsForAI,
  getUpcomingAppointmentsForAI,
  searchPatientsByName,
} from "@/lib/ai/queries"
// Every treatment read comes from the treatment plan model (2026-10-14).
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
      "Belirli bir hastanın diş tedavisi özetini getirir: son yapılan tedavi (tarih, dişler), bekleyen/tamamlanmamış tedaviler ve kalan dişleri, önerilen kontrol tarihi, ileri tarihli randevusu olup olmadığı ve dikkat notları. Finansal erişim varsa para birimine göre kalan bakiye de döner.",
    inputSchema: z.object({ patientName: z.string().describe("Hastanın adı soyadı") }),
    contextSchema: aiToolContextSchema,
    execute: async ({ patientName }, { context }) => {
      const resolved = await resolveSinglePatient(patientName)
      if (resolved.status !== "found") return resolved
      return getPatientSummaryForAI(resolved.patient, context.hasFinancialAccess)
    },
  }),

  getTreatmentPlanStatus: tool({
    description:
      "Tedavi planı durumunu getirir. Hasta adı verilirse o hastanın planlarını kalem kalem döndürür (tedavi, hekim, FDI diş numaraları, tamamlanan dişler, ilerleme: pending=devam ediyor, partial=kısmen tamamlandı, done=tamamlandı; finansal erişim varsa fiyat). Hasta verilmezse kliniğin aktif tedavi planı sayısını döndürür.",
    inputSchema: z.object({
      patientName: z.string().optional().describe("Belirtilirse yalnızca bu hastanın planları getirilir"),
    }),
    contextSchema: aiToolContextSchema,
    execute: async ({ patientName }, { context }) => {
      if (!patientName) return { activeTreatmentPlanCount: await getActiveTreatmentPlanCountForAI() }
      const resolved = await resolveSinglePatient(patientName)
      if (resolved.status !== "found") return resolved
      return getPatientTreatmentPlansForAI(resolved.patient, context.hasFinancialAccess)
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
      "Takip gereken hastaları tespit eder (ileri tarihli randevusu olanlar hariç): kontrolü gelenler (çekim 7 gün, kanal tedavisi 6 ay, implant 6 ay, diş taşı temizliği 6 ay ya da elle girilmiş kontrol tarihi), tedavisi tamamlanmamış ve randevusu olmayanlar (bekleyen dişleriyle), 6 aydır gelmeyenler (periyodik kontrol). Finansal bilgi içermez.",
    inputSchema: z.object({}),
    contextSchema: aiToolContextSchema,
    execute: async () => getFollowUpCandidatesForAI(),
  }),
}

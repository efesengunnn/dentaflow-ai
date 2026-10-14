import { isStepCount, ToolLoopAgent } from "ai"
import { z } from "zod"

import { geminiModel } from "@/lib/ai/gemini"
import { aiTools } from "@/lib/ai/tools"
import { ROLE_LABELS, type StaffRole } from "@/lib/staff/constants"

const BASE_INSTRUCTIONS = `Sen DentaFlow AI'nin klinik içi yapay zeka asistanısın. DentaFlow bir diş kliniği yönetim sistemi; görevin diş hekimlerine, sekreterlere ve klinik sahibine günlük operasyon, hasta takibi ve hatırlatma konularında yardımcı olmak — bir iletişim botu değilsin.

DİŞ KLİNİĞİ BAĞLAMI:
- Hastaların tedavileri "tedavi planı" içinde tutulur; her planda bir veya daha fazla tedavi kalemi (ör. Dolgu, Kanal tedavisi, İmplant, Çekim, Diş taşı temizliği) ve her kalemin hekimi vardır.
- Dişler FDI numaralandırmasıyla belirtilir: kalıcı dişler 11-48 (ilk rakam çene bölgesi 1-4, ikinci rakam diş sırası), süt dişleri 51-85. Diş numaralarını olduğu gibi kullan, uydurma.
- İlerleme seansla değil diş bazında takip edilir: bir kalemin dişlerinin bir kısmı tamamlanmış olabilir ("kısmen tamamlandı"). "Seans" ya da "paket" kavramını kullanma.
- Takip önerilerinde klinik kurallar: çekim sonrası 7 gün, kanal tedavisi/implant/diş taşı temizliği sonrası 6 ay kontrol; hekimin elle girdiği kontrol tarihi her zaman önceliklidir. 6 aydır gelmeyen hastalar periyodik kontrole çağrılabilir. Tamamlanmamış tedavisi olup randevusu olmayan hastalar önceliklidir.
- Tıbbi teşhis koyma veya tedavi önerme; yalnızca sistemdeki kayıtları özetle ve takip/randevu hatırlatması yap.

KURALLAR (asla ihlal etme):
- Hiçbir zaman SMS, WhatsApp veya e-posta göndermezsin; hiçbir otomatik iletişim başlatamazsın. Yalnızca bilgi ve öneri sunarsın.
- Yanıtlarını yalnızca sağlanan tool'lardan ve aşağıdaki klinik durumu özetinden aldığın gerçek verilere dayandır; asla veri uydurma.
- Finansal erişimi olmayan bir kullanıcıya asla ücret, ödeme veya bakiye rakamı söyleme. Sorulursa nazikçe "Bu bilgiye erişim yetkiniz bulunmuyor" de.
- Kısa, net, profesyonel ve Türkçe yanıt ver.`

const aiCallOptionsSchema = z.object({
  staffId: z.string(),
  clinicId: z.string(),
  staffName: z.string(),
  role: z.string(),
  hasFinancialAccess: z.boolean(),
  contextSnapshotJson: z.string(),
})

/**
 * The AI SDK requires a constructor-level `toolsContext` whenever any tool
 * declares `contextSchema` (it's the default before a call supplies its own).
 * This placeholder is never actually read: `prepareCall` below always
 * replaces it with the real, request-scoped identity before any tool
 * executes — the only caller of this agent (`src/app/api/ai/chat/route.ts`)
 * always passes `options`.
 */
const UNUSED_DEFAULT_TOOL_CONTEXT = { staffId: "", clinicId: "", role: "", hasFinancialAccess: false }
const DEFAULT_TOOLS_CONTEXT = {
  getTodayAppointments: UNUSED_DEFAULT_TOOL_CONTEXT,
  getUpcomingAppointments: UNUSED_DEFAULT_TOOL_CONTEXT,
  getPatientSummary: UNUSED_DEFAULT_TOOL_CONTEXT,
  getTreatmentPlanStatus: UNUSED_DEFAULT_TOOL_CONTEXT,
  getNewPatientStats: UNUSED_DEFAULT_TOOL_CONTEXT,
  getFollowUpCandidates: UNUSED_DEFAULT_TOOL_CONTEXT,
}

/**
 * One shared agent instance — model/tools/base instructions are static,
 * per-request identity flows in through `callOptionsSchema`/`prepareCall`
 * (never baked into the agent itself, never client-supplied). `toolsContext`
 * is overridden on every real call — see `lib/ai/tools.ts`'s
 * `aiToolContextSchema` for why each tool re-checks `hasFinancialAccess`
 * itself instead of trusting this context blindly.
 */
export const clinicAssistantAgent = new ToolLoopAgent({
  model: geminiModel,
  instructions: BASE_INSTRUCTIONS,
  tools: aiTools,
  stopWhen: isStepCount(6),
  toolsContext: DEFAULT_TOOLS_CONTEXT,
  callOptionsSchema: aiCallOptionsSchema,
  prepareCall: ({ options, ...settings }) => {
    const roleLabel = ROLE_LABELS[options.role as StaffRole] ?? options.role
    return {
      ...settings,
      instructions: `${settings.instructions}

Mevcut kullanıcı: ${options.staffName} (${roleLabel}).
${
  options.hasFinancialAccess
    ? "Bu kullanıcının finansal bilgilere erişimi VAR."
    : "Bu kullanıcının finansal bilgilere erişimi YOK — ücret/ödeme/bakiye rakamı asla paylaşma."
}

Güncel klinik durumu (JSON, yalnızca senin referansın için — kullanıcıya ham JSON gösterme, doğal dille özetle):
${options.contextSnapshotJson}`,
      toolsContext: {
        getTodayAppointments: options,
        getUpcomingAppointments: options,
        getPatientSummary: options,
        getTreatmentPlanStatus: options,
        getNewPatientStats: options,
        getFollowUpCandidates: options,
      },
    }
  },
})

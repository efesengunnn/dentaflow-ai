import { AI_QUERY_AUDIT_EVENT_TYPE } from "@/lib/ai/constants"
import { createClient } from "@/lib/supabase/server"
import type { StaffRole } from "@/lib/staff/constants"

/**
 * One `audit_logs` row per AI panel request — role and the *size* of the
 * context snapshot sent to the model, never the raw context itself (Sprint
 * 27 spec: "Ham context'i loglama"). A logging failure must never block the
 * chat response, same discipline as the existing `financial_dashboard_view`
 * logging in `lib/dashboard/queries.ts`.
 */
export async function logAIQuery(params: {
  staffId: string
  clinicId: string
  role: StaffRole
  contextSizeChars: number
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("audit_logs").insert({
    clinic_id: params.clinicId,
    staff_id: params.staffId,
    event_type: AI_QUERY_AUDIT_EVENT_TYPE,
    metadata: { role: params.role, context_size_chars: params.contextSizeChars },
  })
  if (error) console.error("ai_query audit log insert failed:", error)
}

import { createAgentUIStreamResponse } from "ai"

import { clinicAssistantAgent } from "@/lib/ai/agent"
import { logAIQuery } from "@/lib/ai/audit"
import { buildAIContextSnapshot, resolveAIRequestIdentity } from "@/lib/ai/context"

// Node.js runtime, not Edge: needs the Supabase server client + GEMINI_API_KEY,
// same requirement as every other server-side data access in this app.
export const runtime = "nodejs"

export async function POST(request: Request) {
  const identity = await resolveAIRequestIdentity()
  if (!identity) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { messages } = await request.json()

  const contextSnapshot = await buildAIContextSnapshot(identity)
  const contextSnapshotJson = JSON.stringify(contextSnapshot)

  await logAIQuery({
    staffId: identity.staffId,
    clinicId: identity.clinicId,
    role: identity.role,
    contextSizeChars: contextSnapshotJson.length,
  })

  return createAgentUIStreamResponse({
    agent: clinicAssistantAgent,
    uiMessages: messages,
    options: {
      staffId: identity.staffId,
      clinicId: identity.clinicId,
      staffName: identity.staffName,
      role: identity.role,
      hasFinancialAccess: identity.hasFinancialAccess,
      contextSnapshotJson,
    },
  })
}

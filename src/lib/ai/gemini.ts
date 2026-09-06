import { createGoogle } from "@ai-sdk/google"

import { DEFAULT_AI_MODEL_ID } from "@/lib/ai/constants"

/**
 * Server-only — never import from a Client Component. Reads `GEMINI_API_KEY`
 * directly (not the SDK's default `GOOGLE_GENERATIVE_AI_API_KEY` name, and
 * not the Vercel AI Gateway) — Sprint 27 founder instruction to wire Gemini
 * directly. The key never reaches the client: only `src/app/api/ai/chat/route.ts`
 * imports this module.
 */
const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY })

export const geminiModel = google(process.env.AI_MODEL ?? DEFAULT_AI_MODEL_ID)

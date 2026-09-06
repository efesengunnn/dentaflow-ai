/**
 * `gemini-2.5-flash` (the founder's original Sprint 27 spec) returns a 404
 * ("no longer available to new users") for freshly created API keys as of
 * 2026-07-29 — verified directly against `GET /v1beta/models` for this
 * project's key, not assumed from training data. `gemini-flash-latest` is
 * Google's own always-current alias for the recommended flash-tier model,
 * the safer default against this exact kind of model-retirement churn.
 */
export const DEFAULT_AI_MODEL_ID = "gemini-flash-latest"

/** `audit_logs.event_type` value for every AI panel request (Sprint 27 migration). */
export const AI_QUERY_AUDIT_EVENT_TYPE = "ai_query"

/**
 * Follow-up detection matches free-text `treatment_series.treatment_type` by
 * keyword — it is still not a structured enum even after the per-staff
 * catalog (`staff_treatment_catalog_items`, Sprint 26.5), see docs/DATABASE.md.
 * Keyword lists cover the Turkish/English spellings actually seeded there.
 * `intervalDays` is the fallback when a session has no doctor-entered
 * `treatments.control_date` — see `getFollowUpCandidatesForAI` in queries.ts.
 */
export const FOLLOW_UP_RULES = [
  { key: "botoks", label: "Botoks", keywords: ["botoks", "botox"], intervalDays: 150 },
  { key: "prp", label: "PRP", keywords: ["prp"], intervalDays: 30 },
  { key: "mezoterapi", label: "Mezoterapi", keywords: ["mezoterapi", "mesoterapi"], intervalDays: 30 },
] as const

export type FollowUpRuleKey = (typeof FOLLOW_UP_RULES)[number]["key"]

/** "30+ gündür gelmeyen aktif hastalar" — days since a patient's last completed session, across any package. */
export const INACTIVE_PATIENT_THRESHOLD_DAYS = 30

/** "Paketi 1 seans kalanlar" — an active series with exactly this many sessions left. */
export const PACKAGE_ENDING_SESSIONS_REMAINING = 1

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

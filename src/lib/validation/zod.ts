import type { z } from "zod"

/**
 * Flattens a ZodError into `{ fieldPath: firstErrorMessage }` — generic over
 * any schema, not module-specific. Used by every module's Server Actions to
 * surface field-level errors back to a React Hook Form via `form.setError`.
 */
export function flattenZodError(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

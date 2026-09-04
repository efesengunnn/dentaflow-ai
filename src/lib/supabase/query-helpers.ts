/**
 * Strips characters that are structurally significant to PostgREST's `.or()`
 * filter DSL (`,` separates conditions, `()` groups them) out of free-text
 * search input before it's interpolated into a filter string — RLS still
 * scopes every result to the caller's own clinic regardless, but an
 * unescaped comma/paren would otherwise just break the query shape. Used by
 * every module's list query (leads, patients, ...) that supports free-text
 * search.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.trim().replace(/[,()]/g, "")
}

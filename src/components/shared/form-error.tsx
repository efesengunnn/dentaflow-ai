/**
 * The top-level Server Action error message shown under a form's fields —
 * previously the identical `<p className="text-sm text-destructive">`
 * hand-typed in 9 different forms. Distinct from `FieldError`
 * (`components/ui/field.tsx`), which is per-field, wired through
 * `FormField`/`Controller`; this is the form's own single `formError` state,
 * set from a Server Action's `{ error }` response.
 */
function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

export { FormError }

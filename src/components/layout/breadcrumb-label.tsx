"use client"

import { useDynamicBreadcrumb } from "@/components/layout/breadcrumb-context"

/**
 * Renders nothing — exists purely so a Server Component (LeadDetailView,
 * PatientDetailView) can supply the record's real name to the breadcrumb
 * without itself becoming a Client Component. `useDynamicBreadcrumb` needs
 * `useEffect`/`useContext`, which only work in a Client Component.
 */
function BreadcrumbLabel({ value }: { value: string }) {
  useDynamicBreadcrumb(value)
  return null
}

export { BreadcrumbLabel }

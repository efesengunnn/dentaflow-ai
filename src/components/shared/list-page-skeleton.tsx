import { PageContainer } from "@/components/shared/page-container"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Generic `loading.tsx` content for a List page (Leads, Patients, ...) —
 * mirrors the real page's PageHeader/FilterBar/DataTable shape so there's no
 * layout jump once data arrives. See Sprint 3.5's profiling note on why this
 * matters (200ms–1.9s measured data-fetch windows).
 */
function ListPageSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-44" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-full sm:max-w-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-7 w-40" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border shadow-xs">
        <div className="border-b p-3">
          <Skeleton className="h-5 w-full max-w-lg" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 border-b p-3 last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-24 rounded-4xl" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

export { ListPageSkeleton }

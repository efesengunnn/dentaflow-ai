import { PageContainer } from "@/components/shared/page-container"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * `loading.tsx` content for the Dashboard — mirrors its real layout so
 * there's no shape jump. Rewritten Sprint 24 (Project Phoenix): the previous
 * version still mirrored Sprint 21's two-KPI-card layout after Sprint 23
 * replaced it with the split financial strip + AI teaser + full-width
 * Bugünkü Randevular + two-column bottom row — a real, user-visible
 * layout-shift bug on every Dashboard load until now.
 */
function DashboardSkeleton() {
  return (
    <PageContainer>
      <div className="rounded-2xl bg-muted/40 px-6 py-8 sm:px-8 sm:py-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        <Skeleton className="mt-5 h-8 w-48 rounded-full" />
      </div>

      <Card className="flex flex-col divide-y overflow-hidden py-0 sm:flex-row sm:divide-x sm:divide-y-0">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex flex-1 items-center gap-4 px-6 py-6 sm:px-8">
            <Skeleton className="size-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
        ))}
      </Card>

      <Skeleton className="h-14 w-full rounded-xl" />

      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, rowIndex) => (
            <Skeleton key={rowIndex} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <Skeleton key={rowIndex} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}

export { DashboardSkeleton }

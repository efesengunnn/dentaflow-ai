import { PageContainer } from "@/components/shared/page-container"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Generic `loading.tsx` content for a two-column Detail page (Leads, Patients, ...). */
function DetailPageSkeleton({ sectionCount = 4 }: { sectionCount?: number }) {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-8">
          {Array.from({ length: sectionCount }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

export { DetailPageSkeleton }

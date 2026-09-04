import { PageContainer } from "@/components/shared/page-container"
import { Skeleton } from "@/components/ui/skeleton"

/** Generic `loading.tsx` content for a single-column "new record" form page. */
function FormPageSkeleton({ fieldCount = 6 }: { fieldCount?: number }) {
  return (
    <PageContainer size="narrow">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-6">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>
    </PageContainer>
  )
}

export { FormPageSkeleton }

import { FileQuestion } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageContainer } from "@/components/shared/page-container"
import { Button } from "@/components/ui/button"

/**
 * Catches `notFound()` calls from within the app shell (a lead/patient id
 * that doesn't exist or belongs to another clinic) — rendered inside
 * `(app)/layout.tsx`, so the sidebar/header/breadcrumb chrome stays intact.
 * A truly unmatched URL falls through to the root `not-found.tsx` instead
 * (see that file for why it deliberately has no app chrome).
 */
export default function AppSegmentNotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={FileQuestion}
        title="Kayıt bulunamadı"
        description="Aradığınız kayıt silinmiş, taşınmış olabilir ya da hiç var olmamış olabilir."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Panele Dön</Link>
          </Button>
        }
      />
    </PageContainer>
  )
}

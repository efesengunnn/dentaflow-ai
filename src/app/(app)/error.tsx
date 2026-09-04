"use client"

import { AlertTriangle, RotateCw } from "lucide-react"
import { useEffect } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageContainer } from "@/components/shared/page-container"
import { Button } from "@/components/ui/button"

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageContainer>
      <EmptyState
        icon={AlertTriangle}
        title="Bir şeyler ters gitti"
        description="Bu sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar denemek genellikle sorunu çözer; devam ederse ekibimize bildirin."
        action={
          <Button variant="outline" onClick={reset}>
            <RotateCw />
            Tekrar Dene
          </Button>
        }
      />
    </PageContainer>
  )
}

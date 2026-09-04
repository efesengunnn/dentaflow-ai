"use client"

import { AlertTriangle } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Catches errors from `(app)/layout.tsx` itself — a segment's own error.tsx
 * can't catch errors thrown in that same segment's layout (Next.js rule), so
 * this is the boundary one level up. No sidebar/header chrome here since the
 * layout that would render them is exactly what failed.
 */
export default function RootSegmentError({
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
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="bg-destructive/10 text-destructive mb-1 flex size-9 items-center justify-center rounded-lg">
            <AlertTriangle className="size-4.5" />
          </div>
          <CardTitle>Bir şeyler ters gitti</CardTitle>
          <CardDescription>
            Sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar denemek genellikle sorunu
            çözer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset} className="w-full">
            Tekrar Dene
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

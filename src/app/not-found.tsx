import { FileQuestion } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Root fallback for any URL that doesn't match a known route at all (typo,
 * stale bookmark, ...). No sidebar/header chrome — same reasoning as
 * `app/error.tsx`: an unmatched route may not even resolve to an
 * authenticated layout, so this can't assume `(app)/layout.tsx` ran.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="bg-muted text-muted-foreground mb-1 flex size-9 items-center justify-center rounded-lg">
            <FileQuestion className="size-4.5" />
          </div>
          <CardTitle>Sayfa bulunamadı</CardTitle>
          <CardDescription>Aradığınız sayfa mevcut değil ya da taşınmış olabilir.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Panele Dön</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

/** A "this module isn't built yet" card for a Detail page's placeholder PageSections (Leads, Patients, ...). */
function PlaceholderCard({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 text-sm text-muted-foreground">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <p>{text}</p>
      </CardContent>
    </Card>
  )
}

export { PlaceholderCard }

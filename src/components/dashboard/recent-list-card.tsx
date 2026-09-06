import { ArrowRight, type LucideIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"

type RecentListItem = {
  id: string
  title: string
  subtitle: string
  href: string
  meta: string
}

type RecentListCardProps = {
  title: string
  icon: LucideIcon
  items: RecentListItem[]
  viewAllHref: string
  emptyTitle: string
  emptyDescription: string
}

/**
 * Project Evolution V2 — shed its `Card` wrapper (ring/shadow/bg) for a
 * plain, hairline-topped section: per the design audit's "Card demoted to
 * control-surface only" rule, a block whose only job is to display a list
 * of facts doesn't need a bordered container — a top rule and generous
 * spacing separate it from its neighbor just as clearly.
 */
function RecentListCard({
  title,
  icon: Icon,
  items,
  viewAllHref,
  emptyTitle,
  emptyDescription,
}: RecentListCardProps) {
  return (
    <div className="border-border flex h-full flex-col gap-4 border-t pt-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={viewAllHref}>
            Tümünü Gör
            <ArrowRight />
          </Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{item.subtitle}</p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">{item.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { RecentListCard }
export type { RecentListItem }

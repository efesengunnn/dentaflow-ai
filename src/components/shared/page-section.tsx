import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type PageSectionProps = React.ComponentProps<"section"> & {
  title?: string
  description?: string
  actions?: React.ReactNode
  /** Optional tinted icon badge next to the title — Sprint 22, opt-in so existing untitled/plain sections are unaffected. */
  icon?: LucideIcon
}

/**
 * A sub-block within a page (below the page-level PageHeader) — its own
 * smaller heading + optional actions, same visual rhythm every time instead
 * of each screen inventing its own sub-heading style.
 */
function PageSection({
  className,
  title,
  description,
  actions,
  icon: Icon,
  children,
  ...props
}: PageSectionProps) {
  return (
    <section
      data-slot="page-section"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {title && (
            <div className="flex items-center gap-2">
              {Icon && <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />}
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && (
                  <p className="text-muted-foreground text-sm">{description}</p>
                )}
              </div>
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export { PageSection }

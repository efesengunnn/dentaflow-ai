import { cn } from "@/lib/utils"

type FilterBarProps = React.ComponentProps<"div"> & {
  search?: React.ReactNode
  filters?: React.ReactNode
}

/**
 * Structural shell only — search/filter *logic* belongs to the module that
 * has real query params to filter on (first real usage: Leads, Sprint 3+).
 * This just guarantees every list screen puts search on the left and filter
 * controls on the right, with the same responsive wrap behavior.
 */
function FilterBar({
  className,
  search,
  filters,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div
      data-slot="filter-bar"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      {search && <div className="w-full sm:max-w-sm">{search}</div>}
      {(filters || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters}
          {children}
        </div>
      )}
    </div>
  )
}

export { FilterBar }

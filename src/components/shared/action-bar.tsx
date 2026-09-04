import { cn } from "@/lib/utils"

type ActionBarProps = React.ComponentProps<"div"> & {
  label?: React.ReactNode
}

/**
 * Structural shell for a contextual action row — page-level primary actions
 * today, and (later) a bulk-selection bar above a DataTable once row
 * selection exists. No selection state lives here; that belongs to whatever
 * screen wires it up.
 */
function ActionBar({ className, label, children, ...props }: ActionBarProps) {
  return (
    <div
      data-slot="action-bar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2",
        className
      )}
      {...props}
    >
      {label && <div className="text-sm text-muted-foreground">{label}</div>}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export { ActionBar }

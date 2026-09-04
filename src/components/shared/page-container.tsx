import { cn } from "@/lib/utils"

type PageContainerProps = React.ComponentProps<"div"> & {
  size?: "default" | "narrow"
}

/**
 * Standard per-page vertical-rhythm wrapper — replaces each page hand-rolling
 * its own `flex flex-col gap-N`. `size="narrow"` caps line length for
 * reading-heavy pages (forms, settings); `size="default"` stays full-width,
 * since this product's most common screen is a data table and our reference
 * dashboards (Linear, Stripe, Vercel) don't cap table width either.
 *
 * Project Phoenix — every page previously just "popped in" with zero
 * transition, the one place page-level motion was completely absent despite
 * a documented, real motion system everywhere else. A one-time, deliberately
 * tiny fade + 4px rise on mount (pure CSS via `tw-animate-css`, no JS/client
 * boundary needed) gives every screen a moment of life without becoming
 * decorative choreography — "restrained motion" per `DESIGN_SYSTEM.md`,
 * applied at the one layer (this wrapper) that reaches every page at once.
 */
function PageContainer({
  className,
  size = "default",
  ...props
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-1 flex flex-col gap-8 duration-500 ease-standard",
        size === "narrow" && "mx-auto w-full max-w-3xl",
        className
      )}
      {...props}
    />
  )
}

export { PageContainer }

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-lg bg-[linear-gradient(100deg,var(--color-muted)_40%,color-mix(in_oklch,var(--color-muted),var(--color-foreground)_6%)_50%,var(--color-muted)_60%)] bg-[length:200%_100%] [animation:shimmer_1.8s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

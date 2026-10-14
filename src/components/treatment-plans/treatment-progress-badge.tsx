import { Badge } from "@/components/ui/badge"
import {
  TREATMENT_PROGRESS_BADGE_VARIANT,
  TREATMENT_PROGRESS_LABELS,
  type TreatmentProgress,
} from "@/lib/treatment-plans/constants"
import { cn } from "@/lib/utils"

/** The 3-colour status bar on the left edge of a treatment row/plan card — yellow / blue / green, same mapping as the badge. */
const PROGRESS_BAR_CLASS: Record<TreatmentProgress, string> = {
  pending: "bg-warning",
  partial: "bg-info",
  done: "bg-success",
}

function TreatmentProgressBadge({ progress, label }: { progress: TreatmentProgress; label?: string }) {
  return <Badge variant={TREATMENT_PROGRESS_BADGE_VARIANT[progress]}>{label ?? TREATMENT_PROGRESS_LABELS[progress]}</Badge>
}

function TreatmentProgressBar({ progress, className }: { progress: TreatmentProgress; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full transition-colors duration-200", PROGRESS_BAR_CLASS[progress], className)}
    />
  )
}

export { TreatmentProgressBadge, TreatmentProgressBar }

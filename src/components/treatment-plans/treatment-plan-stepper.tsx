import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type TreatmentPlanStepperStep = {
  number: number
  label: string
}

/**
 * Sol tarafta dikey liste (masaüstü), üstte kompakt ilerleme çubuğu +
 * "Adım N/M" metni (mobil) — aynı `steps`/`currentStep` state'inden iki
 * farklı sunum, iki ayrı component değil. Sheet genişliği (`sm:max-w-2xl`)
 * gerçek bir yan-panel için dar olduğundan masaüstü sürümü de ince tutuldu
 * (140px, sadece numara + etiket).
 */
function TreatmentPlanStepper({
  steps,
  currentStep,
  className,
}: {
  steps: TreatmentPlanStepperStep[]
  currentStep: number
  className?: string
}) {
  const currentLabel = steps.find((step) => step.number === currentStep)?.label ?? ""

  return (
    <nav aria-label="Tedavi planı adımları" className={cn("shrink-0", className)}>
      <div className="flex flex-col gap-1.5 sm:hidden">
        <div className="flex items-center gap-1.5">
          {steps.map((step) => (
            <span
              key={step.number}
              className={cn("h-1.5 flex-1 rounded-full bg-muted", step.number <= currentStep && "bg-primary")}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Adım {currentStep}/{steps.length} · {currentLabel}
        </p>
      </div>

      <ol className="hidden flex-col gap-1 sm:flex">
        {steps.map((step) => {
          const isDone = step.number < currentStep
          const isCurrent = step.number === currentStep
          return (
            <li
              key={step.number}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150",
                isCurrent && "bg-muted font-medium text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                )}
              >
                {isDone ? <CheckIcon className="size-3" /> : step.number}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { TreatmentPlanStepper }
export type { TreatmentPlanStepperStep }

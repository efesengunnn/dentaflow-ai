"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Check, CheckCircle2, Undo2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatToothList, sortTeeth } from "@/lib/odontogram/fdi"
import { completeTreatmentTeeth, undoTreatmentCompletion } from "@/lib/treatment-plans/actions"
import type { TreatmentLifecycleStatus } from "@/lib/treatment-plans/constants"
import { canCompleteSession, canCorrectOrVoidSession, type TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentCompletion } from "@/lib/treatment-plans/queries"
import { cn } from "@/lib/utils"

export type CompletableTreatmentItem = {
  id: string
  treatmentName: string
  status: TreatmentLifecycleStatus
  toothNumbers: number[]
  completedToothNumbers: number[]
  completions: TreatmentCompletion[]
}

/**
 * The row's "Tamamlandı" / "Geri al" control (2026-10-14). One tooth or no
 * charted teeth: a single click completes the item. Several teeth: a small
 * dialog lets the user tick which teeth were finished, and lists earlier
 * completions so a mistaken one can be undone. Shared by the patient card and
 * the appointment detail so both behave identically.
 */
function CompleteTreatmentControl({
  item,
  actor,
  appointmentId,
}: {
  item: CompletableTreatmentItem
  actor: TreatmentPlanActor
  appointmentId?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])

  const isMultiTooth = item.toothNumbers.length > 1
  const remainingTeeth = sortTeeth(item.toothNumbers.filter((tooth) => !item.completedToothNumbers.includes(tooth)))
  const canComplete = item.status === "active" && canCompleteSession(actor)
  const canUndo = (completion: TreatmentCompletion) =>
    canCorrectOrVoidSession(actor, {
      performedBy: completion.performedById,
      createdAt: completion.createdAt,
      status: "completed",
    })
  const undoableCompletions = item.completions.filter(canUndo)

  function complete(toothNumbers: number[]) {
    startTransition(async () => {
      const result = await completeTreatmentTeeth({ treatmentPlanItemId: item.id, toothNumbers, appointmentId })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        toothNumbers.length > 0
          ? `${item.treatmentName} — Diş ${formatToothList(toothNumbers)} tamamlandı.`
          : `${item.treatmentName} tamamlandı.`,
      )
      setDialogOpen(false)
      router.refresh()
    })
  }

  function undo(sessionId: string) {
    startTransition(async () => {
      const result = await undoTreatmentCompletion({ sessionId })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Tamamlandı işareti geri alındı.")
      router.refresh()
    })
  }

  function openDialog() {
    setSelected([])
    setDialogOpen(true)
  }

  function toggleTooth(tooth: number) {
    setSelected((current) => (current.includes(tooth) ? current.filter((value) => value !== tooth) : [...current, tooth]))
  }

  let trigger: React.ReactNode = null
  if (canComplete) {
    trigger = (
      <Button
        type="button"
        size="sm"
        variant="success"
        loading={isPending && !dialogOpen}
        onClick={() => (isMultiTooth ? openDialog() : complete(item.toothNumbers))}
      >
        <CheckCircle2 />
        Tamamlandı
      </Button>
    )
  } else if (item.status === "completed" && undoableCompletions.length > 0) {
    const single = item.completions.length === 1
    trigger = (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        loading={isPending && !dialogOpen}
        onClick={() => (single ? undo(undoableCompletions[0].sessionId) : openDialog())}
      >
        <Undo2 />
        Geri al
      </Button>
    )
  }

  if (!trigger) return null

  return (
    <>
      {trigger}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{item.treatmentName}</DialogTitle>
            <DialogDescription>
              {remainingTeeth.length > 0
                ? "İşlemi biten dişleri seçin. Kalan dişler takipte kalmaya devam eder."
                : "Bu tedavinin tüm dişleri tamamlandı."}
            </DialogDescription>
          </DialogHeader>

          {canComplete && remainingTeeth.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Kalan dişler</span>
                {remainingTeeth.length > 1 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setSelected(selected.length === remainingTeeth.length ? [] : remainingTeeth)}
                  >
                    {selected.length === remainingTeeth.length ? "Seçimi temizle" : "Tümünü seç"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {remainingTeeth.map((tooth) => {
                  const checked = selected.includes(tooth)
                  return (
                    <button
                      key={tooth}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleTooth(tooth)}
                      className={cn(
                        "inline-flex h-10 min-w-14 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold tabular-nums transition-colors duration-150",
                        checked
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      {checked && <Check className="size-3.5" />}
                      {tooth}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {item.completions.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Tamamlananlar</span>
              <div className="flex flex-col divide-y rounded-xl border">
                {item.completions.map((completion) => (
                  <div key={completion.sessionId} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <Check className="size-4 shrink-0 text-success" />
                      <span className="truncate tabular-nums">
                        {completion.toothNumbers.length > 0 ? `Diş ${formatToothList(completion.toothNumbers)}` : "Tamamlandı"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(completion.performedAt), "d MMM yyyy", { locale: tr })}
                      </span>
                    </span>
                    {canUndo(completion) && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={isPending}
                        onClick={() => undo(completion.sessionId)}
                      >
                        <Undo2 />
                        Geri al
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canComplete && remainingTeeth.length > 0 && (
            <DialogFooter>
              <Button
                type="button"
                variant="success"
                disabled={selected.length === 0}
                loading={isPending}
                onClick={() => complete(sortTeeth(selected))}
                className="w-full sm:w-fit"
              >
                <CheckCircle2 />
                {selected.length > 0 ? `${selected.length} Dişi Tamamla` : "Diş seçin"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export { CompleteTreatmentControl }

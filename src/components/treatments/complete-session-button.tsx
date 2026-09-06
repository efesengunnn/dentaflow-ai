"use client"

import { Check } from "lucide-react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { completeSession } from "@/lib/treatments/actions"

/**
 * The mini sprint's core action — one click, no form. Every incomplete
 * session gets this button (not just the immediate next one, per founder
 * revision: a forgotten session 3 must still be completable later), but the
 * server enforces sequential order — an out-of-order click surfaces the
 * server's own warning via a toast, not a dialog, so a rejected click still
 * feels like the same one-click interaction as a successful one.
 */
function CompleteSessionButton({
  seriesId,
  sessionNumber,
  label = "Tamamlandı",
}: {
  seriesId: string
  sessionNumber: number
  /** Sprint 17 — the patient card's "Sonraki işlem" banner reuses this exact button with session-number-aware copy ("4. Seansı Tamamla") instead of the generic "Tamamlandı"; the action itself is unchanged. */
  label?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await completeSession(seriesId, sessionNumber)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${sessionNumber}. seans tamamlandı.`)
      router.refresh()
    })
  }

  return (
    <Button size="sm" variant="success" loading={isPending} onClick={handleClick}>
      <Check />
      {label}
    </Button>
  )
}

export { CompleteSessionButton }

"use client"

import { Loader2Icon, Trash2, type LucideIcon } from "lucide-react"
import { useId, useState, useTransition, type MouseEvent } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"
import { FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type EntityDeleteDialogProps = {
  title: string
  description: string
  /** `reason` is always passed — `""` when `requireReason` is false, since not every caller needs it. */
  onConfirm: (reason: string) => Promise<{ error?: string } | undefined>
  /** Defaults to the "Sil" destructive trigger — Sprint 26's "Personeli Pasifleştir" passes its own copy/icon/tone instead of a second dialog component. */
  /** Omit (or pass `""`) for an icon-only trigger — e.g. a small "Sil" icon inside a list row. */
  triggerLabel?: string
  triggerIcon?: LucideIcon
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  triggerSize?: VariantProps<typeof buttonVariants>["size"]
  triggerClassName?: string
  /** The dialog's own confirm action — always destructive-styled by default regardless of how subtle the trigger is (e.g. a ghost icon button in a compact list row). */
  confirmVariant?: VariantProps<typeof buttonVariants>["variant"]
  confirmLabel?: string
  confirmingLabel?: string
  /** Sprint 28C.1 — Treatment Plan flexible delete requires a mandatory audit reason; other modules (patients/leads/staff/appointments) leave this off. */
  requireReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
}

/**
 * Generic destructive/state-changing confirmation — every module's action is
 * "call a Server Action, show its error via toast if any" with the same
 * AlertDialog chrome; only the copy, icon, tone, and action differ. Used by
 * Leads and Patients (soft-delete) and Staff (deactivate); reusable by any
 * future module needing the same confirm-then-call-action shape.
 */
function EntityDeleteDialog({
  title,
  description,
  onConfirm,
  triggerLabel = "Sil",
  triggerIcon: TriggerIcon = Trash2,
  triggerVariant = "destructive",
  triggerSize = "default",
  triggerClassName,
  // Defaults to `triggerVariant` — every existing caller relies on this
  // (e.g. Staff's "Pasifleştir" passes `triggerVariant="outline"` and
  // expects a matching outline confirm button, not a red one). Pass
  // `confirmVariant` explicitly only when the trigger is deliberately more
  // subtle than the action itself (e.g. a compact ghost icon in a list row).
  confirmVariant,
  confirmLabel = "Sil",
  confirmingLabel = "Siliniyor...",
  requireReason = false,
  reasonLabel = "Sebep",
  reasonPlaceholder = "Bu kaydı neden siliyorsunuz?",
}: EntityDeleteDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const reasonId = useId()
  const trimmedReason = reason.trim()

  function handleDelete(event: MouseEvent) {
    if (requireReason && !trimmedReason) {
      event.preventDefault()
      setReasonError("Silme sebebini girin.")
      return
    }
    startTransition(async () => {
      const result = await onConfirm(trimmedReason)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setReason("")
          setReasonError(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName} aria-label={triggerLabel || "Sil"}>
          <TriggerIcon />
          {triggerLabel || null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireReason && (
          <div className="flex flex-col gap-1.5 px-4">
            <FieldLabel htmlFor={reasonId}>{reasonLabel}</FieldLabel>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                if (reasonError) setReasonError(null)
              }}
              placeholder={reasonPlaceholder}
              aria-invalid={!!reasonError}
              disabled={isPending}
            />
            {reasonError && <FieldError>{reasonError}</FieldError>}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant={confirmVariant ?? triggerVariant} onClick={handleDelete} disabled={isPending}>
            {/* AlertDialogAction renders via Button's `asChild` path, which
                passes children straight through unwrapped — Button's own
                `loading` prop has no effect here (see button.tsx's asChild
                branch), so the spinner is added directly as a child instead. */}
            {isPending && <Loader2Icon className="animate-spin" />}
            {isPending ? confirmingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { EntityDeleteDialog }

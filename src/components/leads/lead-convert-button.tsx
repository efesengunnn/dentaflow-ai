"use client"

import { Loader2Icon, UserRoundCheck } from "lucide-react"
import { useTransition } from "react"
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
import { Button } from "@/components/ui/button"
import { convertLeadToPatient } from "@/lib/patients/convert-lead"

/**
 * Calls the `convert_lead_to_patient` RPC (see
 * lib/patients/convert-lead.ts for why this is a Postgres function, not a
 * sequence of client calls). Confirmed via AlertDialog first — this is a
 * one-way action (a converted lead can't be un-converted).
 */
function LeadConvertButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [isPending, startTransition] = useTransition()

  function handleConvert() {
    startTransition(async () => {
      const result = await convertLeadToPatient(leadId)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="success">
          <UserRoundCheck />
          Hastaya Dönüştür
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{leadName} hastaya dönüştürülsün mü?</AlertDialogTitle>
          <AlertDialogDescription>
            Yeni bir hasta kaydı oluşturulacak ve bu potansiyel müşteri &quot;Hastaya
            Dönüştü&quot; olarak işaretlenecek. Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant="success" onClick={handleConvert} disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {isPending ? "İşleniyor..." : "Dönüştür"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { LeadConvertButton }

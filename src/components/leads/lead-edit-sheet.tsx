"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { updateLead } from "@/lib/leads/actions"
import type { LeadDetail } from "@/lib/leads/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { LeadForm } from "./lead-form"

function LeadEditSheet({
  lead,
  staffOptions,
}: {
  lead: LeadDetail
  staffOptions: AssignableStaff[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Pencil />
          Düzenle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Potansiyel Müşteriyi Düzenle</SheetTitle>
          <SheetDescription>
            Bilgileri güncelleyin. Değişiklikler aktivite geçmişine kaydedilir.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <LeadForm
            mode="edit"
            defaultValues={{
              fullName: lead.fullName,
              phone: lead.phone,
              email: lead.email ?? "",
              source: lead.source,
              status: lead.status,
              assignedTo: lead.assignedToId ?? "",
              note: "",
            }}
            staffOptions={staffOptions}
            onSubmit={(values) => updateLead(lead.id, values)}
            onSuccess={() => setOpen(false)}
            submitLabel="Kaydet"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { LeadEditSheet }

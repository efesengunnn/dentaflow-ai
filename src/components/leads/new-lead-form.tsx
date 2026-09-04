"use client"

import { createLead } from "@/lib/leads/actions"
import type { AssignableStaff } from "@/lib/staff/queries"
import { LeadForm } from "./lead-form"

function NewLeadForm({ staffOptions }: { staffOptions: AssignableStaff[] }) {
  return (
    <LeadForm
      mode="create"
      staffOptions={staffOptions}
      onSubmit={createLead}
      submitLabel="Oluştur"
    />
  )
}

export { NewLeadForm }

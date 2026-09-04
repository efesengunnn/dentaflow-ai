"use server"

import { redirect } from "next/navigation"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { createClient } from "@/lib/supabase/server"

export type ConvertLeadState = { error: string } | undefined

/**
 * Calls the `convert_lead_to_patient` Postgres function (see
 * supabase/migrations/20260722080000_create_patients.sql) rather than doing
 * this as a sequence of `.from()` calls: lead status change + patient
 * insert + two activity inserts must be all-or-nothing, and PostgREST has
 * no way to span a transaction across separate REST requests. The function
 * itself runs `SECURITY INVOKER`, so RLS still applies exactly as if this
 * action ran the statements directly — a Doctor calling this still gets
 * rejected by the same policies that block Doctor writes everywhere else.
 */
export async function convertLeadToPatient(leadId: string): Promise<ConvertLeadState> {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }

  const supabase = await createClient()
  const { data: patientId, error } = await supabase.rpc("convert_lead_to_patient", {
    p_lead_id: leadId,
  })

  if (error) {
    if (error.message.includes("already converted")) {
      return { error: "Bu potansiyel müşteri zaten hastaya dönüştürülmüş." }
    }
    if (error.code === "42501") {
      return { error: "Bu işlem için yetkiniz yok." }
    }
    if (error.code === "23505") {
      return { error: "Bu telefon numarasıyla zaten bir hasta kaydı var." }
    }
    return { error: "Hastaya dönüştürme işlemi başarısız oldu. Lütfen tekrar deneyin." }
  }

  redirect(`/patients/${patientId}`)
}

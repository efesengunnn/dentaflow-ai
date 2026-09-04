"use server"

import { revalidatePath } from "next/cache"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { patientPaymentFormSchema, type PatientPaymentFormValues } from "@/lib/teeth/schema"
import { createClient } from "@/lib/supabase/server"
import { flattenZodError } from "@/lib/validation/zod"

export type PaymentActionState =
  | { error: string; fieldErrors?: Record<string, string>; success?: undefined }
  | { success: true; error?: undefined }
  | undefined

export async function addPatientPayment(
  patientId: string,
  values: PatientPaymentFormValues,
): Promise<PaymentActionState> {
  const parsed = patientPaymentFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Formda hatalar var.", fieldErrors: flattenZodError(parsed.error) }
  }

  const staffMember = await getCurrentStaffMember()
  if (!staffMember) return { error: "Oturum bulunamadı." }
  if (staffMember.role !== "owner" && staffMember.role !== "secretary") {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("patient_payments").insert({
    clinic_id: staffMember.clinicId,
    patient_id: patientId,
    amount: parsed.data.amount,
    paid_at: parsed.data.paidAt,
    method: parsed.data.method?.trim() || null,
    note: parsed.data.note?.trim() || null,
    created_by: staffMember.userId,
    updated_by: staffMember.userId,
  })

  if (error) return { error: "Ödeme kaydedilemedi." }

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

import { createClient } from "@/lib/supabase/server"

export type PatientPaymentRow = {
  id: string
  amount: number
  paidAt: string
  method: string | null
  note: string | null
}

export async function getPatientPayments(patientId: string): Promise<PatientPaymentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patient_payments")
    .select("id, amount, paid_at, method, note")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("paid_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    amount: row.amount,
    paidAt: row.paid_at,
    method: row.method,
    note: row.note,
  }))
}

export type PatientBalance = {
  totalCharged: number
  totalPaid: number
  remainingBalance: number
}

/**
 * Derived, never stored: sum of completed tooth_treatments.price minus sum
 * of patient_payments.amount. A treatment with no price set contributes 0
 * ("Ücret Belirlenmedi" is a display concern, not counted as owed until
 * someone sets it) — same convention as ClinicFlow AI's series balance.
 */
export async function getPatientBalance(patientId: string): Promise<PatientBalance> {
  const supabase = await createClient()

  const [{ data: treatments, error: treatmentsError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase
        .from("tooth_treatments")
        .select("price")
        .eq("patient_id", patientId)
        .eq("status", "tamamlandi")
        .is("deleted_at", null),
      supabase
        .from("patient_payments")
        .select("amount")
        .eq("patient_id", patientId)
        .is("deleted_at", null),
    ])

  if (treatmentsError) throw treatmentsError
  if (paymentsError) throw paymentsError

  const totalCharged = (treatments ?? []).reduce((sum, row) => sum + (row.price ?? 0), 0)
  const totalPaid = (payments ?? []).reduce((sum, row) => sum + row.amount, 0)

  return { totalCharged, totalPaid, remainingBalance: totalCharged - totalPaid }
}

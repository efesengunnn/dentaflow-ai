"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ClinicSettings } from "@/lib/clinic/queries"
import { formatCurrency } from "@/lib/format/currency"
import { formatToothList } from "@/lib/odontogram/fdi"
import type { PatientDetail } from "@/lib/patients/queries"
import { TREATMENT_PAYMENT_ENTRY_TYPE_LABELS, TREATMENT_PAYMENT_METHOD_LABELS } from "@/lib/treatment-plans/constants"
import type { TreatmentPlanDetail } from "@/lib/treatment-plans/queries"

/**
 * Patient card "Özet" tab — a printable treatment + payment summary the clinic
 * hands to the patient (founder request, modeled on a real dental clinic's
 * planning printout, minus the tooth diagram). Combines every non-voided plan
 * item across all of the patient's plans, lists payments with dates, and
 * closes with per-currency Toplam / Ödenen / Kalan. Built entirely from data
 * the patient page already fetched (`treatmentPlans`) — no extra query.
 *
 * `data-print-region` marks this block as the only thing that prints (see the
 * `@media print` rule in globals.css); everything else on the page is hidden.
 */

type ProcedureRow = {
  key: string
  date: string
  provider: string
  teeth: string
  treatment: string
  price: number | null
  currency: string
}

type PaymentRow = {
  key: string
  date: string
  method: string
  entryLabel: string | null
  signedAmount: number
  currency: string
}

type CurrencyTotal = { currency: string; total: number | null; paid: number; remaining: number | null }

/** payment/adjustment add to the paid total; refund/void subtract — same ledger rule as the app. */
function paymentSign(entryType: TreatmentPlanDetail["payments"][number]["entryType"]): 1 | -1 {
  return entryType === "refund" || entryType === "void" ? -1 : 1
}

function sortCurrencies(currencies: string[]): string[] {
  return [...currencies].sort((a, b) => (a === "TRY" ? -1 : b === "TRY" ? 1 : a.localeCompare(b)))
}

function PatientSummaryReport({
  patient,
  clinic,
  treatmentPlans,
}: {
  patient: PatientDetail
  clinic: ClinicSettings | null
  treatmentPlans: TreatmentPlanDetail[]
}) {
  const plans = treatmentPlans.filter((plan) => plan.status !== "voided")

  const procedures: ProcedureRow[] = plans
    .flatMap((plan) =>
      plan.items
        .filter((item) => item.status !== "voided")
        .map((item) => ({
          key: item.id,
          date: plan.createdAt,
          provider: item.providerName,
          teeth: item.toothNumbers.length > 0 ? formatToothList(item.toothNumbers) : "—",
          treatment: item.treatmentName,
          price: item.totalPrice,
          currency: item.currency,
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.treatment.localeCompare(b.treatment, "tr"))

  const payments: PaymentRow[] = plans
    .flatMap((plan) => plan.payments)
    .map((payment) => ({
      key: payment.id,
      date: payment.paidAt,
      method: TREATMENT_PAYMENT_METHOD_LABELS[payment.method],
      entryLabel: payment.entryType === "payment" ? null : TREATMENT_PAYMENT_ENTRY_TYPE_LABELS[payment.entryType],
      signedAmount: paymentSign(payment.entryType) * payment.amount,
      currency: payment.currency,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Per-currency Toplam / Ödenen / Kalan — computed inline (client-safe) so a
  // mixed TRY+EUR patient never sums across currencies.
  const totalsMap = new Map<string, { total: number | null; paid: number }>()
  for (const row of procedures) {
    const entry = totalsMap.get(row.currency) ?? { total: null, paid: 0 }
    if (row.price !== null) entry.total = (entry.total ?? 0) + row.price
    totalsMap.set(row.currency, entry)
  }
  for (const row of payments) {
    const entry = totalsMap.get(row.currency) ?? { total: null, paid: 0 }
    entry.paid += row.signedAmount
    totalsMap.set(row.currency, entry)
  }
  const totals: CurrencyTotal[] = sortCurrencies(Array.from(totalsMap.keys())).map((currency) => {
    const entry = totalsMap.get(currency)!
    return {
      currency,
      total: entry.total,
      paid: entry.paid,
      remaining: entry.total === null ? null : entry.total - entry.paid,
    }
  })

  const today = format(new Date(), "d MMMM yyyy", { locale: tr })
  const hasContent = procedures.length > 0 || payments.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="print-hidden" onClick={() => window.print()}>
          <Printer />
          Yazdır
        </Button>
      </div>

      <div
        data-print-region
        className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-white p-6 text-slate-900 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0"
      >
        {/* Clinic header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-base font-semibold">{clinic?.name ?? "Klinik"}</p>
            {clinic?.address && <p className="text-slate-600">{clinic.address}</p>}
            {clinic?.phone && <p className="text-slate-600">Tel: {clinic.phone}</p>}
          </div>
          {clinic?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- clinic logo is an owner-pasted external URL, not a local asset for next/image
            <img src={clinic.logoUrl} alt="" className="h-14 w-auto max-w-40 object-contain" />
          ) : null}
        </div>

        {/* Title + patient */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Tedavi Planı Özeti</h2>
          <span className="text-sm text-slate-500 tabular-nums">{today}</span>
        </div>
        <p className="pb-4 text-sm">
          <span className="text-slate-500">Hasta: </span>
          <span className="font-medium">{patient.fullName}</span>
        </p>

        {!hasContent ? (
          <p className="py-8 text-center text-sm text-slate-500">Bu hasta için gösterilecek tedavi veya ödeme kaydı yok.</p>
        ) : (
          <>
            {/* Procedures */}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-slate-300 text-left text-xs text-slate-500 uppercase">
                  <th className="py-2 pr-3 font-medium">Tarih</th>
                  <th className="py-2 pr-3 font-medium">Hekim</th>
                  <th className="py-2 pr-3 font-medium">Diş</th>
                  <th className="py-2 pr-3 font-medium">İşlem</th>
                  <th className="py-2 pl-3 text-right font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {procedures.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{format(new Date(row.date), "dd.MM.yyyy")}</td>
                    <td className="py-1.5 pr-3">{row.provider}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{row.teeth}</td>
                    <td className="py-1.5 pr-3">{row.treatment}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                      {row.price === null ? "—" : formatCurrency(row.price, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Payments */}
            {payments.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-semibold">Ödemeler</h3>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {payments.map((row) => (
                      <tr key={row.key} className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{format(new Date(row.date), "dd.MM.yyyy")}</td>
                        <td className="py-1.5 pr-3">
                          {row.method}
                          {row.entryLabel && <span className="text-slate-500"> · {row.entryLabel}</span>}
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(row.signedAmount, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div className="mt-6 flex flex-col gap-2 border-t-2 border-slate-300 pt-4">
              {totals.map((entry) => (
                <div key={entry.currency} className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Toplam Tedavi Ücreti</span>
                    <span className="font-medium tabular-nums">
                      {entry.total === null ? "Belirlenmedi" : formatCurrency(entry.total, entry.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ödenen</span>
                    <span className="font-medium tabular-nums">{formatCurrency(entry.paid, entry.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-base font-semibold">
                    <span>Kalan Bakiye</span>
                    <span className="tabular-nums">
                      {entry.remaining === null ? "—" : formatCurrency(entry.remaining, entry.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export { PatientSummaryReport }

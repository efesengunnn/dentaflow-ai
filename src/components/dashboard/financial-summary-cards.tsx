"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Ban, ChevronRight, Landmark, Trash2, Undo2, Wallet } from "lucide-react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { TruncatedCell } from "@/components/shared/truncated-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format/currency"
import type { CurrencyAmount, MonthlyRevenueDetailRow, OutstandingBalanceDetailRow } from "@/lib/dashboard/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { fetchTreatmentSeriesDetail, voidTreatmentSeries } from "@/lib/treatments/actions"
import { TREATMENT_PAYMENT_ENTRY_TYPE_LABELS, type TreatmentPaymentEntryType } from "@/lib/treatments/constants"
import type { TreatmentPaymentRow, TreatmentSeriesDetail } from "@/lib/treatments/queries"
import {
  deleteTreatmentPayment,
  deleteTreatmentPlanPermanently,
  fetchTreatmentPlanDetail,
} from "@/lib/treatment-plans/actions"
import type { TreatmentPlanActor } from "@/lib/treatment-plans/permissions"
import type { TreatmentPlanDetail, TreatmentPlanPaymentRow } from "@/lib/treatment-plans/queries"
import { DashboardDrilldownSheet } from "./dashboard-drilldown-sheet"
import { FinancialDetailFilters } from "./financial-detail-filters"

/**
 * Performance (2026-07-29 founder report: pages feel sluggish again) — these
 * Sheets pull in the entire Treatment module's form/schema tree (session
 * forms, edit-series form, add-payment form, correction form). Statically
 * importing them here would add all of that weight to the Dashboard's initial
 * JS for every visit, even though they only render after an explicit
 * "Ödemeyi Düzelt" / "Geçersiz Say" / "Detay" click. Code-split so that
 * weight loads on demand instead — same "don't pay for what you didn't ask
 * for" principle as this module's own `fetchCatalog*` on-demand fetches.
 * Sprint 32 adds the new-model (Tedavi Planı) equivalents alongside the
 * legacy series ones.
 */
const PaymentCorrectionSheet = dynamic(
  () => import("@/components/treatments/payment-correction-sheet").then((mod) => mod.PaymentCorrectionSheet),
  { ssr: false },
)
const TreatmentSeriesDetailSheet = dynamic(
  () =>
    import("@/components/treatments/treatment-series-detail-sheet").then((mod) => mod.TreatmentSeriesDetailSheet),
  { ssr: false },
)
const TreatmentPlanPaymentCorrectionSheet = dynamic(
  () =>
    import("@/components/treatment-plans/treatment-plan-payment-correction-sheet").then(
      (mod) => mod.TreatmentPlanPaymentCorrectionSheet,
    ),
  { ssr: false },
)
const TreatmentPlanDetailSheet = dynamic(
  () => import("@/components/treatment-plans/treatment-plan-detail-sheet").then((mod) => mod.TreatmentPlanDetailSheet),
  { ssr: false },
)

/**
 * `payment`/`adjustment` add, `refund`/`void` subtract — same rule as
 * `lib/treatments/queries.ts`'s `paymentLedgerSign`, reimplemented as a
 * one-line constant here rather than imported: that module transitively
 * pulls in `@/lib/supabase/server` (cookies-based, server-only), which
 * cannot be bundled into a Client Component.
 */
function ledgerSign(entryType: TreatmentPaymentEntryType): 1 | -1 {
  return entryType === "refund" || entryType === "void" ? -1 : 1
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function isWithinDateRange(isoDate: string, from: Date | undefined, to: Date | undefined): boolean {
  const date = new Date(isoDate)
  if (from && date < startOfDay(from)) return false
  if (to && date > endOfDay(to)) return false
  return true
}

function startOfThisMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** TRY first, then the rest alphabetically — matches the server aggregate's order. */
function sortByCurrency(rows: CurrencyAmount[]): CurrencyAmount[] {
  return [...rows].sort((a, b) =>
    a.currency === "TRY" ? -1 : b.currency === "TRY" ? 1 : a.currency.localeCompare(b.currency),
  )
}

/** Net revenue per currency (ledger sign applied) from the currently visible rows. */
function revenueTotalsByCurrency(rows: MonthlyRevenueDetailRow[]): CurrencyAmount[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + ledgerSign(row.entryType) * row.amount)
  }
  return sortByCurrency(
    Array.from(totals.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .filter((row) => row.amount !== 0),
  )
}

/** Remaining balance per currency from the currently visible rows. */
function balanceTotalsByCurrency(rows: OutstandingBalanceDetailRow[]): CurrencyAmount[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.remainingBalance)
  }
  return sortByCurrency(
    Array.from(totals.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .filter((row) => row.amount !== 0),
  )
}

/** "12.000,00 ₺ + 600,00 €", or "0,00 ₺" when there's nothing — currencies never summed together. */
function joinCurrencyAmounts(rows: CurrencyAmount[]): string {
  if (rows.length === 0) return formatCurrency(0, "TRY")
  return rows.map((row) => formatCurrency(row.amount, row.currency)).join(" + ")
}

const AGING_BALANCE_THRESHOLD_DAYS = 30

/** A real, explainable "risk" signal (Sprint 25 audit): no payment in 30+ days on a still-open balance. */
function isAgingBalance(lastPaymentDate: string): boolean {
  const daysSincePayment = (Date.now() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
  return daysSincePayment >= AGING_BALANCE_THRESHOLD_DAYS
}

/**
 * Founder decision 2026-07-28 — each "Bu Ay Toplam Ciro" row is one
 * `treatment_payments` record, so correction opens the same Sheet the patient
 * card uses, seeded with that row's own data. Sprint 32 — the row now carries
 * a `source` ("series" | "plan") that picks the legacy or new-model Sheet, and
 * its own `currency` (was hardcoded TRY).
 */
function buildRevenueColumns(opts: {
  canCorrectPayments: boolean
  canDeletePayments: boolean
  onCorrected: () => void
  onDeleted: () => void
}): ColumnDef<MonthlyRevenueDetailRow, unknown>[] {
  const columns: ColumnDef<MonthlyRevenueDetailRow, unknown>[] = [
    {
      accessorKey: "patientName",
      header: "Hasta",
      cell: ({ row }) => <TruncatedCell value={row.original.patientName} maxWidthClassName="max-w-48" bold />,
    },
    {
      accessorKey: "treatmentType",
      header: "İşlem",
      cell: ({ row }) => <TruncatedCell value={row.original.treatmentType} />,
    },
    {
      accessorKey: "staffName",
      header: "İşlemi Yapan Personel",
      cell: ({ row }) => <TruncatedCell value={row.original.staffName} />,
    },
    {
      accessorKey: "amount",
      header: "Tutar",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="tabular-nums">{formatCurrency(row.original.amount, row.original.currency)}</span>
          {row.original.entryType !== "payment" && (
            <Badge variant="warning">{TREATMENT_PAYMENT_ENTRY_TYPE_LABELS[row.original.entryType]}</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "paidAt",
      header: "Tarih",
      cell: ({ row }) => format(new Date(row.original.paidAt), "d MMM yyyy", { locale: tr }),
    },
  ]

  if (opts.canCorrectPayments || opts.canDeletePayments) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        // Correction ("İade / Düzelt") only makes sense on an actual payment,
        // never on an existing refund/adjustment row. Deletion (founder
        // decision 2026-09-13) applies to any ledger row — it removes that
        // exact record outright, source and entry type notwithstanding.
        const canCorrectThisRow = opts.canCorrectPayments && row.original.entryType === "payment"

        return (
          <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
            {canCorrectThisRow &&
              (row.original.source === "series" ? (
                <PaymentCorrectionSheet
                  seriesId={row.original.seriesId ?? ""}
                  payment={
                    {
                      id: row.original.id,
                      seriesId: row.original.seriesId ?? "",
                      relatedPaymentId: null,
                      amount: row.original.amount,
                      entryType: row.original.entryType,
                      method: row.original.method,
                      currency: row.original.currency,
                      paidAt: row.original.paidAt,
                      recordedByName: null,
                      note: null,
                      createdAt: row.original.paidAt,
                    } satisfies TreatmentPaymentRow
                  }
                  onSuccess={opts.onCorrected}
                />
              ) : (
                <TreatmentPlanPaymentCorrectionSheet
                  treatmentPlanId={row.original.treatmentPlanId ?? ""}
                  payment={
                    {
                      id: row.original.id,
                      treatmentPlanId: row.original.treatmentPlanId ?? "",
                      relatedPaymentId: null,
                      amount: row.original.amount,
                      entryType: row.original.entryType,
                      method: row.original.method,
                      currency: row.original.currency,
                      paidAt: row.original.paidAt,
                      recordedByName: null,
                      note: null,
                      createdAt: row.original.paidAt,
                    } satisfies TreatmentPlanPaymentRow
                  }
                  onSuccess={opts.onCorrected}
                />
              ))}

            {opts.canDeletePayments && (
              <EntityDeleteDialog
                title="Ödeme silinsin mi?"
                description={`${formatCurrency(row.original.amount, row.original.currency)} tutarındaki bu ödeme kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz ve ciro toplamından düşer.`}
                triggerLabel=""
                triggerIcon={Trash2}
                triggerVariant="ghost"
                triggerSize="icon-sm"
                confirmVariant="destructive"
                confirmLabel="Sil"
                onConfirm={async () => {
                  const result = await deleteTreatmentPayment(row.original.id)
                  if (result?.success) opts.onDeleted()
                  return result
                }}
              />
            )}
          </div>
        )
      },
    })
  }

  return columns
}

function buildOutstandingBalanceColumns(opts: {
  canCorrectPayments: boolean
  canDeletePayments: boolean
  canManageTreatments: boolean
  onCorrectSeries: (seriesId: string) => void
  onOpenPlan: (planId: string) => void
  onVoided: () => void
  onPlanDeleted: () => void
}): ColumnDef<OutstandingBalanceDetailRow, unknown>[] {
  const columns: ColumnDef<OutstandingBalanceDetailRow, unknown>[] = [
    {
      accessorKey: "patientName",
      header: "Hasta",
      cell: ({ row }) => <TruncatedCell value={row.original.patientName} maxWidthClassName="max-w-40" bold />,
    },
    {
      accessorKey: "treatmentType",
      header: "Tedavi",
      cell: ({ row }) => <TruncatedCell value={row.original.treatmentType} maxWidthClassName="max-w-32" />,
    },
    {
      accessorKey: "totalFee",
      header: "Toplam Ücret",
      cell: ({ row }) =>
        row.original.totalFee === null ? (
          <span className="text-muted-foreground">Belirlenmedi</span>
        ) : (
          <span className="tabular-nums">{formatCurrency(row.original.totalFee, row.original.currency)}</span>
        ),
    },
    {
      accessorKey: "paidAmount",
      header: "Ödenen",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCurrency(row.original.paidAmount, row.original.currency)}</span>
      ),
    },
    {
      accessorKey: "remainingBalance",
      header: "Kalan",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.original.remainingBalance, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "lastPaymentDate",
      header: "Son Ödeme Tarihi",
      // Sprint 25 (Project Rebirth) — `lastPaymentDate` was already fetched and
      // already displayed here, just never used as a signal: a design audit
      // found it's the one honest "risk" indicator sitting in already-fetched
      // data (a debt that's never been paid, or hasn't moved in a month, is a
      // materially different situation than one paid down last week — same
      // "Kalan" figure, different urgency). No new query, no invented score —
      // just a real date compared to today.
      cell: ({ row }) => {
        const { lastPaymentDate } = row.original
        const isStale = lastPaymentDate === null || isAgingBalance(lastPaymentDate)
        return (
          <div className="flex items-center gap-2">
            {lastPaymentDate ? (
              <span>{format(new Date(lastPaymentDate), "d MMM yyyy", { locale: tr })}</span>
            ) : (
              <span className="text-muted-foreground">Hiç ödeme yok</span>
            )}
            {isStale && <Badge variant="warning">Eski Bakiye</Badge>}
          </div>
        )
      },
    },
    {
      accessorKey: "staffName",
      header: "Sorumlu Personel",
      cell: ({ row }) => <TruncatedCell value={row.original.staffName} />,
    },
  ]

  if (opts.canCorrectPayments || opts.canManageTreatments || opts.canDeletePayments) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        // New-model rows open the full Tedavi Planı detail Sheet (payment
        // correction + soft delete, gated by `actor` inside). Since Sprint 32
        // they also get a direct hard-delete "Sil" (founder decision
        // 2026-09-13) that permanently wipes the whole plan.
        if (row.original.source === "plan") {
          if (!opts.canCorrectPayments && !opts.canManageTreatments && !opts.canDeletePayments) return null
          return (
            <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
              {(opts.canCorrectPayments || opts.canManageTreatments) && (
                <Button size="sm" variant="ghost" onClick={() => opts.onOpenPlan(row.original.treatmentPlanId ?? "")}>
                  <Undo2 />
                  Detay / Düzelt
                </Button>
              )}
              {opts.canDeletePayments && (
                <EntityDeleteDialog
                  title="Tedavi planı kalıcı olarak silinsin mi?"
                  description={`"${row.original.treatmentType}" planı ve altındaki tüm kalemler, tamamlanmış seanslar ve ödemeler kalıcı olarak silinecek. Bu işlem geri alınamaz. Randevular silinmez, yalnızca bu planla bağlantıları kaldırılır.`}
                  triggerLabel=""
                  triggerIcon={Trash2}
                  triggerVariant="ghost"
                  triggerSize="icon-sm"
                  confirmVariant="destructive"
                  confirmLabel="Kalıcı Sil"
                  confirmingLabel="Siliniyor..."
                  onConfirm={async () => {
                    const result = await deleteTreatmentPlanPermanently(row.original.treatmentPlanId ?? "")
                    if (result?.success) opts.onPlanDeleted()
                    return result
                  }}
                />
              )}
            </div>
          )
        }

        return (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            {opts.canCorrectPayments && (
              <Button size="sm" variant="ghost" onClick={() => opts.onCorrectSeries(row.original.seriesId ?? "")}>
                <Undo2 />
                Ödemeyi Düzelt
              </Button>
            )}
            {opts.canManageTreatments && (
              <EntityDeleteDialog
                title="Paket geçersiz sayılsın mı?"
                description={
                  row.original.paidAmount > 0
                    ? `"${row.original.treatmentType}" paketi geçersiz sayılacak. Bu pakette ${formatCurrency(row.original.paidAmount, row.original.currency)} ödeme kaydı var — bu tutar da ciro raporlarından çıkacak. Geçmiş korunur, kayıt kalıcı silinmez.`
                    : `"${row.original.treatmentType}" paketi geçersiz sayılacak. Geçmiş korunur, kayıt kalıcı silinmez.`
                }
                onConfirm={async () => {
                  const result = await voidTreatmentSeries(row.original.seriesId ?? "")
                  if (result?.success) opts.onVoided()
                  return result
                }}
                triggerLabel="Geçersiz Say"
                triggerIcon={Ban}
                triggerVariant="outline"
                confirmLabel="Geçersiz Say"
                confirmingLabel="İşleniyor..."
              />
            )}
          </div>
        )
      },
    })
  }

  return columns
}

/**
 * Project Evolution V2 — dropped the tinted icon-square (the audit's most-
 * cited "generic admin panel" tell) in favor of a small, heavy, tracked-out
 * label doing the categorization work the icon badge used to do.
 *
 * Sprint 32 — the figure is per currency now (a plan can mix TRY + EUR),
 * rendered as one line per currency; currencies are never summed together.
 * Money figures stay in the UI voice (Geist Sans `font-semibold`), not the
 * display serif — see `docs/DESIGN_SYSTEM.md`'s Project Evolution V2 section;
 * do not re-apply the serif here without being asked again.
 */
function FinancialFigure({
  label,
  values,
  hint,
  tone,
  onClick,
  breakdown,
}: {
  label: string
  values: CurrencyAmount[]
  hint?: string
  icon: typeof Landmark
  tone: "success" | "warning"
  onClick: () => void
  /** Founder decision 2026-07-28 — "ne kadarını kim yapmış" geri getirildi (Sprint 23'te kaldırılmıştı), bu kez ayrı bir kart değil, ana rakamın altında küçük fontla — aynı veriden (`revenueDetail`), yeni sorgu yok. */
  breakdown?: { label: string; value: string }[]
}) {
  const lines = values.length === 0 ? [{ currency: "TRY", amount: 0 }] : values
  return (
    <button
      type="button"
      onClick={onClick}
      className="group hover:bg-muted/40 flex flex-1 flex-col items-start gap-1 px-6 py-7 text-left transition-colors sm:px-8"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-semibold tracking-[0.08em] uppercase",
            tone === "success" ? "text-success" : "text-warning",
          )}
        >
          {label}
        </p>
        <ChevronRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex flex-col">
        {lines.map((line) => (
          <p key={line.currency} className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(line.amount, line.currency)}
          </p>
        ))}
      </div>
      {hint && <p className="text-muted-foreground/70 text-xs">{hint}</p>}
      {breakdown && breakdown.length > 0 && (
        <div className="mt-1.5 flex w-full flex-col gap-0.5">
          {breakdown.map((row) => (
            <div key={row.label} className="text-muted-foreground/80 flex w-full justify-between gap-2 text-xs">
              <span className="truncate">{row.label}</span>
              <span className="tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

type FinancialSummaryCardsProps = {
  /** Sprint 32 — per currency (TRY + EUR possible), never summed together. */
  monthlyRevenue: CurrencyAmount[]
  outstandingBalance: CurrencyAmount[]
  revenueDetail: MonthlyRevenueDetailRow[]
  outstandingBalanceDetail: OutstandingBalanceDetailRow[]
  staffOptions: AssignableStaff[]
  /** Sprint 24 — disambiguates this all-time, clinic-wide figure from the hero's today-only "N tahsilat bekliyor" chip. */
  outstandingBalanceHint?: string
  /** Founder decision 2026-07-28 — gates "Ödemeyi Düzelt" on both drill-downs; owner/secretary only, same rule as the patient card's correction trigger. */
  canCorrectPayments: boolean
  /** Founder decision 2026-09-13 — gates the "Sil" (hard delete) action on the Ciro drill-down rows; owner/secretary only, mirrors the DELETE RLS policy on treatment_payments. */
  canDeletePayments: boolean
  /** Gates "Paketi Geçersiz Say" on the Bekleyen Bakiye drill-down — matches `treatment_series_update_clinical_roles` RLS (owner/doctor/beauty_specialist), not `canCorrectPayments`, since voiding a package is a change to the package itself. */
  canManageTreatments: boolean
  /** Passed straight through to the on-demand legacy detail Sheet's own "Ödeme Ekle" trigger — same flag every other Treatment Module screen uses (owner/secretary/beauty_specialist). */
  canManagePayments: boolean
  /** Sprint 32 — new-model drill-down opens the Tedavi Planı detail Sheet, which gates its own correct/pay/delete affordances by this actor (same object the patient card builds). */
  actor: TreatmentPlanActor
}

/**
 * "Bu Ay Toplam Ciro"/"Bekleyen Bakiye" — Sprint 8.5 made both cards open a
 * Sheet with the underlying rows; Sprint 9 matures those Sheets with sorting,
 * a staff + date-range filter, and a live total. Sprint 32 spans both
 * treatment models: each row carries its `source` + `currency`, so the
 * drill-downs open the right correction Sheet and totals are per currency.
 * Filtering runs entirely client-side over the already-fetched row arrays —
 * no extra round trip per filter change.
 */
function FinancialSummaryCards({
  monthlyRevenue,
  outstandingBalance,
  revenueDetail,
  outstandingBalanceDetail,
  staffOptions,
  outstandingBalanceHint,
  canCorrectPayments,
  canDeletePayments,
  canManageTreatments,
  canManagePayments,
  actor,
}: FinancialSummaryCardsProps) {
  const router = useRouter()
  const [revenueOpen, setRevenueOpen] = useState(false)
  const [balanceOpen, setBalanceOpen] = useState(false)

  // "Ödemeyi Düzelt" (legacy Bekleyen Bakiye row) — reuses the patient card's
  // own detail Sheet on demand rather than a second payment-picker UI.
  const [detailSeriesId, setDetailSeriesId] = useState<string | null>(null)
  const [detailSeries, setDetailSeries] = useState<TreatmentSeriesDetail | null>(null)

  const loadSeriesDetail = useCallback((seriesId: string) => {
    fetchTreatmentSeriesDetail(seriesId).then(setDetailSeries)
  }, [])

  const openSeriesDetail = useCallback(
    (seriesId: string) => {
      setDetailSeriesId(seriesId)
      loadSeriesDetail(seriesId)
    },
    [loadSeriesDetail],
  )

  // "Detay / Düzelt" (new-model row) — opens the full Tedavi Planı detail
  // Sheet, fetched on demand, same pattern as the legacy series path above.
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null)
  const [detailPlan, setDetailPlan] = useState<TreatmentPlanDetail | null>(null)

  const openPlanDetail = useCallback((planId: string) => {
    setDetailPlanId(planId)
    fetchTreatmentPlanDetail(planId).then(setDetailPlan)
  }, [])

  const [revenueStaffId, setRevenueStaffId] = useState("all")
  const [revenueDateFrom, setRevenueDateFrom] = useState<Date | undefined>(() => startOfThisMonth())
  const [revenueDateTo, setRevenueDateTo] = useState<Date | undefined>(() => new Date())

  const [balanceStaffId, setBalanceStaffId] = useState("all")
  const [balanceDateFrom, setBalanceDateFrom] = useState<Date | undefined>(undefined)
  const [balanceDateTo, setBalanceDateTo] = useState<Date | undefined>(undefined)

  const revenueByStaff = useMemo(() => {
    const totals = new Map<string, { label: string; currency: string; amount: number }>()
    for (const row of revenueDetail) {
      const staffName = row.staffName ?? "—"
      const key = `${staffName}|${row.currency}`
      const existing = totals.get(key) ?? { label: staffName, currency: row.currency, amount: 0 }
      existing.amount += ledgerSign(row.entryType) * row.amount
      totals.set(key, existing)
    }
    return Array.from(totals.values())
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((row) => ({ label: row.label, value: formatCurrency(row.amount, row.currency) }))
  }, [revenueDetail])

  const filteredRevenueRows = useMemo(
    () =>
      revenueDetail.filter(
        (row) =>
          (revenueStaffId === "all" || row.staffId === revenueStaffId) &&
          isWithinDateRange(row.paidAt, revenueDateFrom, revenueDateTo),
      ),
    [revenueDetail, revenueStaffId, revenueDateFrom, revenueDateTo],
  )
  const filteredRevenueTotals = useMemo(() => revenueTotalsByCurrency(filteredRevenueRows), [filteredRevenueRows])

  const filteredBalanceRows = useMemo(
    () =>
      outstandingBalanceDetail.filter(
        (row) =>
          (balanceStaffId === "all" || row.staffId === balanceStaffId) &&
          (row.lastPaymentDate === null || isWithinDateRange(row.lastPaymentDate, balanceDateFrom, balanceDateTo)),
      ),
    [outstandingBalanceDetail, balanceStaffId, balanceDateFrom, balanceDateTo],
  )
  const filteredBalanceTotals = useMemo(() => balanceTotalsByCurrency(filteredBalanceRows), [filteredBalanceRows])

  const defaultRevenueFrom = startOfThisMonth()
  const defaultRevenueTo = new Date()
  const revenueHasActiveFilters: boolean =
    revenueStaffId !== "all" ||
    !revenueDateFrom ||
    !revenueDateTo ||
    revenueDateFrom.toDateString() !== defaultRevenueFrom.toDateString() ||
    revenueDateTo.toDateString() !== defaultRevenueTo.toDateString()
  function resetRevenueFilters() {
    setRevenueStaffId("all")
    setRevenueDateFrom(startOfThisMonth())
    setRevenueDateTo(new Date())
  }

  const balanceHasActiveFilters = balanceStaffId !== "all" || Boolean(balanceDateFrom) || Boolean(balanceDateTo)
  function resetBalanceFilters() {
    setBalanceStaffId("all")
    setBalanceDateFrom(undefined)
    setBalanceDateTo(undefined)
  }

  const revenueColumns = useMemo(
    () =>
      buildRevenueColumns({
        canCorrectPayments,
        canDeletePayments,
        onCorrected: () => router.refresh(),
        onDeleted: () => router.refresh(),
      }),
    [canCorrectPayments, canDeletePayments, router],
  )
  const outstandingBalanceColumns = useMemo(
    () =>
      buildOutstandingBalanceColumns({
        canCorrectPayments,
        canDeletePayments,
        canManageTreatments,
        onCorrectSeries: openSeriesDetail,
        onOpenPlan: openPlanDetail,
        onVoided: () => router.refresh(),
        onPlanDeleted: () => router.refresh(),
      }),
    [canCorrectPayments, canDeletePayments, canManageTreatments, router, openSeriesDetail, openPlanDetail],
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col divide-y overflow-hidden py-0 sm:flex-row sm:divide-x sm:divide-y-0">
        <FinancialFigure
          label="Bu Ay Toplam Ciro"
          values={monthlyRevenue}
          icon={Landmark}
          tone="success"
          onClick={() => setRevenueOpen(true)}
          breakdown={revenueByStaff}
        />
        <FinancialFigure
          label="Bekleyen Bakiye"
          values={outstandingBalance}
          hint={outstandingBalanceHint}
          icon={Wallet}
          tone="warning"
          onClick={() => setBalanceOpen(true)}
        />
      </Card>

      <DashboardDrilldownSheet
        open={revenueOpen}
        onOpenChange={setRevenueOpen}
        title="Bu Ay Toplam Ciro"
        description={`Toplam ${joinCurrencyAmounts(filteredRevenueTotals)} — ${filteredRevenueRows.length} işlem.`}
        enableSorting
        filters={
          <FinancialDetailFilters
            staffOptions={staffOptions}
            staffId={revenueStaffId}
            onStaffIdChange={setRevenueStaffId}
            dateFrom={revenueDateFrom}
            onDateFromChange={setRevenueDateFrom}
            dateTo={revenueDateTo}
            onDateToChange={setRevenueDateTo}
            onReset={resetRevenueFilters}
            hasActiveFilters={revenueHasActiveFilters}
          />
        }
        columns={revenueColumns}
        rows={filteredRevenueRows}
        emptyIcon={Landmark}
        emptyTitle="Seçilen aralıkta tahsilat yok"
        emptyDescription="Filtreleri genişleterek daha fazla kayıt görebilirsiniz."
      />
      <DashboardDrilldownSheet
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        title="Bekleyen Bakiye"
        description={`Toplam ${joinCurrencyAmounts(filteredBalanceTotals)} — kalan bakiyesi olan ${filteredBalanceRows.length} tedavi.`}
        enableSorting
        filters={
          <FinancialDetailFilters
            staffOptions={staffOptions}
            staffId={balanceStaffId}
            onStaffIdChange={setBalanceStaffId}
            dateFrom={balanceDateFrom}
            onDateFromChange={setBalanceDateFrom}
            dateTo={balanceDateTo}
            onDateToChange={setBalanceDateTo}
            onReset={resetBalanceFilters}
            hasActiveFilters={balanceHasActiveFilters}
          />
        }
        columns={outstandingBalanceColumns}
        rows={filteredBalanceRows}
        emptyIcon={Wallet}
        emptyTitle="Seçilen aralıkta bekleyen bakiye yok"
        emptyDescription="Filtreleri genişleterek daha fazla kayıt görebilirsiniz."
      />

      {detailSeries && (
        <TreatmentSeriesDetailSheet
          series={detailSeries}
          staffOptions={staffOptions}
          canManageTreatments={canManageTreatments}
          canManagePayments={canManagePayments}
          canCorrectPayments={canCorrectPayments}
          open={detailSeriesId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDetailSeriesId(null)
              setDetailSeries(null)
            }
          }}
          onDataChanged={() => detailSeriesId && loadSeriesDetail(detailSeriesId)}
        />
      )}

      {detailPlan && (
        <TreatmentPlanDetailSheet
          plan={detailPlan}
          isOwner={actor.role === "owner"}
          providers={staffOptions}
          actor={actor}
          open={detailPlanId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDetailPlanId(null)
              setDetailPlan(null)
            }
          }}
        />
      )}
    </div>
  )
}

export { FinancialSummaryCards }

"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Ban, ChevronRight, Landmark, Undo2, Wallet } from "lucide-react"
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
import type { MonthlyRevenueDetailRow, OutstandingBalanceDetailRow } from "@/lib/dashboard/queries"
import type { AssignableStaff } from "@/lib/staff/queries"
import { fetchTreatmentSeriesDetail, voidTreatmentSeries } from "@/lib/treatments/actions"
import { TREATMENT_PAYMENT_ENTRY_TYPE_LABELS, type TreatmentPaymentEntryType } from "@/lib/treatments/constants"
import type { TreatmentPaymentRow, TreatmentSeriesDetail } from "@/lib/treatments/queries"
import { DashboardDrilldownSheet } from "./dashboard-drilldown-sheet"
import { FinancialDetailFilters } from "./financial-detail-filters"

/**
 * Performance (2026-07-29 founder report: pages feel sluggish again) — these
 * two Sheets pull in the entire Treatment module's form/schema tree (session
 * forms, edit-series form, add-payment form, correction form). Statically
 * importing them here would add all of that weight to the Dashboard's initial
 * JS for every visit, even though they only render after an explicit
 * "Ödemeyi Düzelt" / "Geçersiz Say" click. Code-split so that weight loads on
 * demand instead — same "don't pay for what you didn't ask for" principle as
 * this module's own `fetchCatalogForStaff` on-demand fetch pattern.
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

const AGING_BALANCE_THRESHOLD_DAYS = 30

/** A real, explainable "risk" signal (Sprint 25 audit): no payment in 30+ days on a still-open balance. */
function isAgingBalance(lastPaymentDate: string): boolean {
  const daysSincePayment = (Date.now() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
  return daysSincePayment >= AGING_BALANCE_THRESHOLD_DAYS
}

/**
 * Founder decision 2026-07-28 — "Bu Ay Toplam Ciro"'daki her satır zaten tek
 * bir `treatment_payments` kaydı, o yüzden düzeltme burada doğrudan mevcut
 * `PaymentCorrectionSheet`'i (patient card'ın kullandığı aynı bileşen) o
 * satırın kendi verisiyle açıyor — yeni bir form yazılmadı.
 */
function buildRevenueColumns(opts: {
  canCorrectPayments: boolean
  onCorrected: () => void
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
          <span className="tabular-nums">{formatCurrency(row.original.amount)}</span>
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

  if (opts.canCorrectPayments) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        if (row.original.entryType !== "payment") return null
        const payment: TreatmentPaymentRow = {
          id: row.original.id,
          seriesId: row.original.seriesId,
          relatedPaymentId: null,
          amount: row.original.amount,
          entryType: row.original.entryType,
          method: row.original.method,
          currency: "TRY",
          paidAt: row.original.paidAt,
          recordedByName: null,
          note: null,
          createdAt: row.original.paidAt,
        }
        return (
          <div onClick={(event) => event.stopPropagation()}>
            <PaymentCorrectionSheet seriesId={row.original.seriesId} payment={payment} onSuccess={opts.onCorrected} />
          </div>
        )
      },
    })
  }

  return columns
}

function buildOutstandingBalanceColumns(opts: {
  canCorrectPayments: boolean
  canManageTreatments: boolean
  onCorrectSeries: (seriesId: string) => void
  onVoided: () => void
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
      header: "Toplam Paket Ücreti",
      cell: ({ row }) =>
        row.original.totalFee === null ? (
          <span className="text-muted-foreground">Belirlenmedi</span>
        ) : (
          <span className="tabular-nums">{formatCurrency(row.original.totalFee)}</span>
        ),
    },
    {
      accessorKey: "paidAmount",
      header: "Ödenen",
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.paidAmount)}</span>,
    },
    {
      accessorKey: "remainingBalance",
      header: "Kalan",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatCurrency(row.original.remainingBalance)}</span>
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

  if (opts.canCorrectPayments || opts.canManageTreatments) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {opts.canCorrectPayments && (
            <Button size="sm" variant="ghost" onClick={() => opts.onCorrectSeries(row.original.seriesId)}>
              <Undo2 />
              Ödemeyi Düzelt
            </Button>
          )}
          {opts.canManageTreatments && (
            <EntityDeleteDialog
              title="Paket geçersiz sayılsın mı?"
              description={
                row.original.paidAmount > 0
                  ? `"${row.original.treatmentType}" paketi geçersiz sayılacak. Bu pakette ${formatCurrency(row.original.paidAmount)} ödeme kaydı var — bu tutar da ciro raporlarından çıkacak. Geçmiş korunur, kayıt kalıcı silinmez.`
                  : `"${row.original.treatmentType}" paketi geçersiz sayılacak. Geçmiş korunur, kayıt kalıcı silinmez.`
              }
              onConfirm={async () => {
                const result = await voidTreatmentSeries(row.original.seriesId)
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
      ),
    })
  }

  return columns
}

/**
 * Sprint 23 — replaces two separate `StatCard`s with one split strip (a
 * single `Card`, divided in half). Two adjacent white boxes read as two
 * unrelated facts; a finance app's balance summary (Stripe's "Balance"
 * header is the reference point, not the literal design) puts related
 * money figures in one shared surface so they read as one connected
 * "here's where the money stands" statement instead of competing KPI tiles.
 */
/**
 * Project Evolution V2 — dropped the tinted icon-square (the audit's most-
 * cited "generic admin panel" tell) in favor of a small, heavy, tracked-out
 * label doing the categorization work the icon badge used to do.
 *
 * The figure itself tried the display-serif/`font-light` treatment and the
 * founder reverted it on sight ("beğenmedim") — back to Geist Sans
 * `font-semibold`, same as every other pre-Evolution-V2 hero number. Money
 * figures specifically stay in the UI voice, not the display serif; the
 * serif remains scoped to the Dashboard greeting, Patient Detail's name,
 * and Kalan Bakiye only (see `docs/DESIGN_SYSTEM.md`'s Project Evolution V2
 * section) — do not re-apply it here without being asked again.
 */
function FinancialFigure({
  label,
  value,
  hint,
  tone,
  onClick,
  breakdown,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Landmark
  tone: "success" | "warning"
  onClick: () => void
  /** Founder decision 2026-07-28 — "ne kadarını kim yapmış" geri getirildi (Sprint 23'te kaldırılmıştı), bu kez ayrı bir kart değil, ana rakamın altında küçük fontla — aynı veriden (`revenueDetail`), yeni sorgu yok. */
  breakdown?: { label: string; value: string }[]
}) {
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
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
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
  monthlyRevenue: number
  outstandingBalance: number
  revenueDetail: MonthlyRevenueDetailRow[]
  outstandingBalanceDetail: OutstandingBalanceDetailRow[]
  staffOptions: AssignableStaff[]
  /** Sprint 24 — disambiguates this all-time, clinic-wide figure from the hero's today-only "N tahsilat bekliyor" chip. */
  outstandingBalanceHint?: string
  /** Founder decision 2026-07-28 — gates "Ödemeyi Düzelt" on both drill-downs; owner/secretary only, same rule as the patient card's correction trigger. */
  canCorrectPayments: boolean
  /** Gates "Paketi Geçersiz Say" on the Bekleyen Bakiye drill-down — matches `treatment_series_update_clinical_roles` RLS (owner/doctor/beauty_specialist), not `canCorrectPayments`, since voiding a package is a change to the package itself. */
  canManageTreatments: boolean
  /** Passed straight through to the on-demand detail Sheet's own "Ödeme Ekle" trigger — same flag every other Treatment Module screen uses (owner/secretary/beauty_specialist). */
  canManagePayments: boolean
}

/**
 * "Bu Ay Toplam Ciro"/"Bekleyen Bakiye" — Sprint 8.5 made both cards open a
 * Sheet with the underlying rows; Sprint 9 matures those Sheets with
 * sorting, a staff + date-range filter, and a live total that reflects
 * whatever's currently visible (not just the unfiltered headline number).
 * Filtering runs entirely client-side over the already-fetched row arrays —
 * no extra round trip per filter change, and the row counts involved are a
 * single pilot clinic's data, small enough that this stays instant.
 */
function FinancialSummaryCards({
  monthlyRevenue,
  outstandingBalance,
  revenueDetail,
  outstandingBalanceDetail,
  staffOptions,
  outstandingBalanceHint,
  canCorrectPayments,
  canManageTreatments,
  canManagePayments,
}: FinancialSummaryCardsProps) {
  const router = useRouter()
  const [revenueOpen, setRevenueOpen] = useState(false)
  const [balanceOpen, setBalanceOpen] = useState(false)

  // "Ödemeyi Düzelt" (Bekleyen Bakiye row) — reuses the patient card's own
  // detail Sheet on demand rather than a second payment-picker UI. Fetched
  // fresh each time a series is opened; `onDataChanged` below keeps it in
  // sync with corrections made while it's open (a plain `router.refresh()`
  // alone wouldn't touch this client-fetched copy).
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

  const [revenueStaffId, setRevenueStaffId] = useState("all")
  const [revenueDateFrom, setRevenueDateFrom] = useState<Date | undefined>(() => startOfThisMonth())
  const [revenueDateTo, setRevenueDateTo] = useState<Date | undefined>(() => new Date())

  const [balanceStaffId, setBalanceStaffId] = useState("all")
  const [balanceDateFrom, setBalanceDateFrom] = useState<Date | undefined>(undefined)
  const [balanceDateTo, setBalanceDateTo] = useState<Date | undefined>(undefined)

  const revenueByStaff = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of revenueDetail) {
      const staffName = row.staffName ?? "—"
      totals.set(staffName, (totals.get(staffName) ?? 0) + ledgerSign(row.entryType) * row.amount)
    }
    return Array.from(totals.entries())
      .filter(([, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([staffName, amount]) => ({ label: staffName, value: formatCurrency(amount) }))
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
  const filteredRevenueTotal = useMemo(
    () => filteredRevenueRows.reduce((sum, row) => sum + ledgerSign(row.entryType) * row.amount, 0),
    [filteredRevenueRows],
  )

  const filteredBalanceRows = useMemo(
    () =>
      outstandingBalanceDetail.filter(
        (row) =>
          (balanceStaffId === "all" || row.staffId === balanceStaffId) &&
          (row.lastPaymentDate === null || isWithinDateRange(row.lastPaymentDate, balanceDateFrom, balanceDateTo)),
      ),
    [outstandingBalanceDetail, balanceStaffId, balanceDateFrom, balanceDateTo],
  )
  const filteredBalanceTotal = useMemo(
    () => filteredBalanceRows.reduce((sum, row) => sum + row.remainingBalance, 0),
    [filteredBalanceRows],
  )

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
    () => buildRevenueColumns({ canCorrectPayments, onCorrected: () => router.refresh() }),
    [canCorrectPayments, router],
  )
  const outstandingBalanceColumns = useMemo(
    () =>
      buildOutstandingBalanceColumns({
        canCorrectPayments,
        canManageTreatments,
        onCorrectSeries: openSeriesDetail,
        onVoided: () => router.refresh(),
      }),
    [canCorrectPayments, canManageTreatments, router, openSeriesDetail],
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col divide-y overflow-hidden py-0 sm:flex-row sm:divide-x sm:divide-y-0">
        <FinancialFigure
          label="Bu Ay Toplam Ciro"
          value={formatCurrency(monthlyRevenue)}
          icon={Landmark}
          tone="success"
          onClick={() => setRevenueOpen(true)}
          breakdown={revenueByStaff}
        />
        <FinancialFigure
          label="Bekleyen Bakiye"
          value={formatCurrency(outstandingBalance)}
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
        description={`Toplam ${formatCurrency(filteredRevenueTotal)} — ${filteredRevenueRows.length} işlem.`}
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
        description={`Toplam ${formatCurrency(filteredBalanceTotal)} — kalan bakiyesi olan ${filteredBalanceRows.length} tedavi.`}
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
    </div>
  )
}

export { FinancialSummaryCards }

import { Workbook } from "exceljs"
import { NextResponse } from "next/server"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { currentStaffHasPermission } from "@/lib/permissions/queries"
import { TREATMENT_STATUS_LABELS } from "@/lib/treatments/constants"
import { getAllTreatmentSeriesForExport } from "@/lib/treatments/queries"
import { createClient } from "@/lib/supabase/server"

/**
 * Independent of `patients/export` — a treatment/finance-focused sheet, not
 * a patient-contact sheet. One row per `treatment_series` (a standalone
 * treatment is just a `totalSessions === 1` series, so it needs no special
 * case here — see `lib/treatments/queries.ts`). Same Route Handler +
 * exceljs pattern as `leads/export`/`patients/export`/`appointments/export`.
 *
 * `financial_access`-gated, defense in depth: this is Tier 3 clinic-wide
 * financial data (docs/DATABASE.md), even though each individual row is
 * Tier-1-legal — exporting every patient's fee/paid/balance in one document
 * is exactly the aggregation the AI Data Access Principle warns about
 * (docs/ARCHITECTURE.md). The route checks explicitly (this block) *and*
 * `getAllTreatmentSeriesForExport()` checks again internally — two
 * independent layers, so a future refactor of either one alone can't
 * silently drop the only gate. Found and fixed during Sprint 7's final
 * audit — see docs/SPRINT_7_ARCHITECTURE_REVIEW.md.
 */
export async function GET() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const hasFinancialAccess = await currentStaffHasPermission("financial_access")
  if (!hasFinancialAccess) {
    return NextResponse.json({ error: "Bu işlem için finansal erişim yetkiniz yok." }, { status: 403 })
  }

  const rows = await getAllTreatmentSeriesForExport()
  if (!rows) {
    return NextResponse.json({ error: "Bu işlem için finansal erişim yetkiniz yok." }, { status: 403 })
  }

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Tedaviler")
  sheet.columns = [
    { header: "Hasta", key: "patientName", width: 24 },
    { header: "TC Kimlik", key: "tcKimlikNo", width: 16 },
    { header: "Tedavi", key: "treatmentType", width: 22 },
    { header: "Toplam Paket Ücreti", key: "totalFee", width: 18 },
    { header: "Ödenen", key: "paidAmount", width: 16 },
    { header: "Kalan", key: "remainingBalance", width: 16 },
    { header: "Toplam Seans", key: "totalSessions", width: 14 },
    { header: "Tamamlanan Seans", key: "completedSessions", width: 16 },
    { header: "Durum", key: "status", width: 16 },
    { header: "Tedaviyi Yapan Personel", key: "staffName", width: 24 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    sheet.addRow({
      patientName: row.patientName,
      tcKimlikNo: row.patientTcKimlikNo ?? "",
      treatmentType: row.treatmentType,
      totalFee: row.totalFee,
      paidAmount: row.paidAmount,
      remainingBalance: row.remainingBalance,
      totalSessions: row.totalSessions,
      completedSessions: row.completedSessions,
      status: TREATMENT_STATUS_LABELS[row.status],
      staffName: row.primaryStaffName ?? "",
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  const supabase = await createClient()
  const { error: auditError } = await supabase.from("audit_logs").insert({
    clinic_id: staffMember.clinicId,
    staff_id: staffMember.userId,
    event_type: "export",
    metadata: { export_type: "treatments", row_count: rows.length },
  })
  if (auditError) console.error("treatments export audit log insert failed:", auditError)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="tedaviler.xlsx"',
    },
  })
}

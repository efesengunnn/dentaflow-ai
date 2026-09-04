import { Workbook } from "exceljs"
import { NextResponse } from "next/server"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads/constants"
import { getAllLeadsForExport } from "@/lib/leads/queries"

/**
 * Streams an .xlsx of every lead matching the current List filters (not just
 * the visible page) — a Route Handler rather than a Server Action, since
 * Server Actions return serializable data, not a binary file download.
 * `exceljs` writes only (no untrusted-file parsing here); see
 * `ARCHITECTURE.md` for why `xlsx`/SheetJS was rejected for this feature.
 */
export async function GET(request: Request) {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rows = await getAllLeadsForExport({
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as LeadStatus | null) ?? undefined,
    assignedTo: searchParams.get("assignedTo") ?? undefined,
  })

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Potansiyel Müşteriler")
  sheet.columns = [
    { header: "Ad Soyad", key: "fullName", width: 24 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "E-posta", key: "email", width: 26 },
    { header: "Kaynak", key: "source", width: 16 },
    { header: "Durum", key: "status", width: 22 },
    { header: "Sorumlu Personel", key: "assignedTo", width: 22 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    sheet.addRow({
      fullName: row.fullName,
      phone: formatTurkishPhoneDisplay(row.phone),
      email: row.email ?? "",
      source: LEAD_SOURCE_LABELS[row.source],
      status: LEAD_STATUS_LABELS[row.status],
      assignedTo: row.assignedToName ?? "",
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="potansiyel-musteriler.xlsx"',
    },
  })
}

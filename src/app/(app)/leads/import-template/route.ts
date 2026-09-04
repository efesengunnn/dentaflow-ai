import { Workbook } from "exceljs"
import { NextResponse } from "next/server"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/leads/constants"

/** Downloadable blank template matching what `previewLeadImport` expects to read back. */
export async function GET() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

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
  sheet.addRow({
    fullName: "Ayşe Yılmaz",
    phone: "532 123 45 67",
    email: "ayse@ornek.com",
    source: LEAD_SOURCE_LABELS.website,
    status: LEAD_STATUS_LABELS.new,
    assignedTo: "",
  })
  sheet.getRow(2).font = { italic: true, color: { argb: "FF888888" } }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="potansiyel-musteri-sablonu.xlsx"',
    },
  })
}

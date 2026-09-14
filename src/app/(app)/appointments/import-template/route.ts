import { Workbook } from "exceljs"
import { NextResponse } from "next/server"

import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/constants"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"

/** Downloadable blank template matching what `previewAppointmentImport` expects to read back. */
export async function GET() {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Randevular")
  sheet.columns = [
    { header: "Hasta Telefon", key: "patientPhone", width: 18 },
    { header: "Hekim", key: "staffName", width: 22 },
    { header: "Tarih", key: "date", width: 14 },
    { header: "Saat", key: "time", width: 10 },
    { header: "Sebep", key: "reason", width: 28 },
    { header: "Durum", key: "status", width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.addRow({
    patientPhone: "532 123 45 67",
    staffName: "Dr. Ayşe Yılmaz",
    date: "22.07.2026",
    time: "14:30",
    reason: "Kontrol",
    status: APPOINTMENT_STATUS_LABELS.scheduled,
  })
  sheet.getRow(2).font = { italic: true, color: { argb: "FF888888" } }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="randevu-sablonu.xlsx"',
    },
  })
}

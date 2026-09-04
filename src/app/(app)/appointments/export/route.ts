import { Workbook } from "exceljs"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { NextResponse } from "next/server"

import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/appointments/constants"
import { getAllAppointmentsForExport } from "@/lib/appointments/queries"
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"

/**
 * Streams an .xlsx of every appointment matching the current List filters —
 * a Route Handler, not a Server Action, same reasoning as
 * `leads/export/route.ts` (binary file download, not serializable data).
 */
export async function GET(request: Request) {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rows = await getAllAppointmentsForExport({
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as AppointmentStatus | null) ?? undefined,
    staffId: searchParams.get("staffId") ?? undefined,
    patientId: searchParams.get("patientId") ?? undefined,
  })

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Randevular")
  sheet.columns = [
    { header: "Tarih", key: "date", width: 14 },
    { header: "Saat", key: "time", width: 10 },
    { header: "Hasta", key: "patientName", width: 24 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "Sağlayıcı", key: "staffName", width: 22 },
    { header: "Sebep", key: "reason", width: 28 },
    { header: "Durum", key: "status", width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    const startsAt = new Date(row.startsAt)
    sheet.addRow({
      date: format(startsAt, "dd.MM.yyyy", { locale: tr }),
      time: format(startsAt, "HH:mm"),
      patientName: row.patientName,
      phone: formatTurkishPhoneDisplay(row.patientPhone),
      staffName: row.staffName,
      reason: row.reason ?? "",
      status: APPOINTMENT_STATUS_LABELS[row.status],
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="randevular.xlsx"',
    },
  })
}

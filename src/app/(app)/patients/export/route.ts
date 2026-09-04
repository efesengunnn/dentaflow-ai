import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Workbook } from "exceljs"
import { NextResponse } from "next/server"

import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member"
import { dateStringToLocalDate } from "@/lib/format/date"
import { formatTurkishPhoneDisplay } from "@/lib/format/phone"
import type { PatientOrigin } from "@/lib/patients/constants"
import { getAllPatientsForExport } from "@/lib/patients/queries"
import { createClient } from "@/lib/supabase/server"

/** Same rationale as leads/export/route.ts — a Route Handler, since Server Actions can't return a binary file. */
export async function GET(request: Request) {
  const staffMember = await getCurrentStaffMember()
  if (!staffMember) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }
  if (staffMember.role !== "owner") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rows = await getAllPatientsForExport({
    search: searchParams.get("search") ?? undefined,
    origin: (searchParams.get("origin") as PatientOrigin | null) ?? undefined,
  })

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Hastalar")
  sheet.columns = [
    { header: "Ad Soyad", key: "fullName", width: 24 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "TC Kimlik No", key: "tcKimlikNo", width: 16 },
    { header: "Doğum Tarihi", key: "dateOfBirth", width: 16 },
    { header: "E-posta", key: "email", width: 26 },
    { header: "Kaynak", key: "origin", width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    const dateOfBirth = dateStringToLocalDate(row.dateOfBirth)
    sheet.addRow({
      fullName: row.fullName,
      phone: formatTurkishPhoneDisplay(row.phone),
      tcKimlikNo: row.tcKimlikNo ?? "",
      dateOfBirth: dateOfBirth ? format(dateOfBirth, "d MMMM yyyy", { locale: tr }) : "",
      email: row.email ?? "",
      origin: row.leadId ? "Potansiyel Müşteriden Dönüştürüldü" : "Doğrudan Kayıt",
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  const supabase = await createClient()
  const { error: auditError } = await supabase.from("audit_logs").insert({
    clinic_id: staffMember.clinicId,
    staff_id: staffMember.userId,
    event_type: "export",
    metadata: { export_type: "patients", row_count: rows.length },
  })
  if (auditError) console.error("patients export audit log insert failed:", auditError)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="hastalar.xlsx"',
    },
  })
}

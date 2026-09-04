import { Workbook } from "exceljs"

import { parseAppointmentStatusLabel } from "@/lib/appointments/constants"
import type { AppointmentStatus } from "@/lib/appointments/constants"
import { cellToString } from "@/lib/format/excel-cell"
import { normalizeTurkishPhone } from "@/lib/format/phone"

export type AppointmentImportRow = {
  rowNumber: number
  patientPhone: string
  staffName: string
  date: string
  time: string
  reason: string | null
  status: AppointmentStatus
}

export type AppointmentImportRowError = {
  rowNumber: number
  message: string
}

export type AppointmentImportPreview = {
  validRows: AppointmentImportRow[]
  errors: AppointmentImportRowError[]
  totalRows: number
}

const HEADER_ALIASES: Record<string, string> = {
  "hasta telefon": "patientPhone",
  "hasta telefonu": "patientPhone",
  telefon: "patientPhone",
  sağlayıcı: "staffName",
  personel: "staffName",
  "sorumlu personel": "staffName",
  tarih: "date",
  saat: "time",
  sebep: "reason",
  açıklama: "reason",
  durum: "status",
}

/** yyyy-mm-dd or dd.mm.yyyy / dd/mm/yyyy — same accepted formats as `parsePatientsWorkbook`'s date of birth. */
function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  return null
}

/** "HH:MM" or "HH.MM" (Excel sometimes round-trips a time cell with a dot). */
function normalizeTime(raw: string): string | null {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return null
  const [, hour, minute] = match
  const hourNum = Number(hour)
  const minuteNum = Number(minute)
  if (hourNum > 23 || minuteNum > 59) return null
  return `${String(hourNum).padStart(2, "0")}:${String(minuteNum).padStart(2, "0")}`
}

/**
 * Reads an uploaded .xlsx and returns a preview (valid rows + per-row
 * errors) — same two-step pattern as `parseLeadsWorkbook`/
 * `parsePatientsWorkbook`, never commits anything. Unlike Leads/Patients,
 * this parser only validates *shape* (phone/date/time format, duration,
 * status label); resolving `patientPhone`/`staffName` to real ids happens in
 * `previewAppointmentImport` (actions.ts) since that needs a DB round trip —
 * a row that fails that lookup becomes an error there, not here, but is
 * still counted in the same final success/failure report.
 */
export async function parseAppointmentsWorkbook(buffer: Buffer): Promise<AppointmentImportPreview> {
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const sheet = workbook.worksheets[0]

  if (!sheet) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: "Dosyada okunabilir bir sayfa bulunamadı." }],
      totalRows: 0,
    }
  }

  const columnMap = new Map<number, string>()
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const raw = cellToString(cell.value).trim().toLocaleLowerCase("tr")
    const field = HEADER_ALIASES[raw]
    if (field) columnMap.set(colNumber, field)
  })

  const mappedFields = [...columnMap.values()]
  if (!mappedFields.includes("patientPhone") || !mappedFields.includes("staffName")) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          message:
            "Beklenen sütun başlıkları bulunamadı. Lütfen şablonu indirip aynı başlıkları kullanın.",
        },
      ],
      totalRows: 0,
    }
  }

  const validRows: AppointmentImportRow[] = []
  const errors: AppointmentImportRowError[] = []
  let totalRows = 0

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const values: Record<string, string> = {}
    columnMap.forEach((field, colNumber) => {
      values[field] = cellToString(row.getCell(colNumber).value).trim()
    })

    const hasAnyValue = Object.values(values).some((value) => value !== "")
    if (!hasAnyValue) return

    totalRows += 1

    const patientPhone = normalizeTurkishPhone(values.patientPhone ?? "")
    if (!patientPhone) {
      errors.push({ rowNumber, message: "Hasta telefonu geçersiz (10 haneli olmalı)." })
      return
    }

    const staffName = values.staffName?.trim() || ""
    if (!staffName) {
      errors.push({ rowNumber, message: "Sağlayıcı (personel) boş olamaz." })
      return
    }

    const date = normalizeDate(values.date ?? "")
    if (!date) {
      errors.push({ rowNumber, message: "Tarih formatı geçersiz (GG.AA.YYYY veya YYYY-AA-GG)." })
      return
    }

    const time = normalizeTime(values.time ?? "")
    if (!time) {
      errors.push({ rowNumber, message: "Saat formatı geçersiz (SS:DD)." })
      return
    }

    const status = values.status ? (parseAppointmentStatusLabel(values.status) ?? "scheduled") : "scheduled"

    validRows.push({
      rowNumber,
      patientPhone,
      staffName,
      date,
      time,
      reason: values.reason?.trim() || null,
      status,
    })
  })

  return { validRows, errors, totalRows }
}

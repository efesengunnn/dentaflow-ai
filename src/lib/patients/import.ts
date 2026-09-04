import { Workbook } from "exceljs"

import { cellToString } from "@/lib/format/excel-cell"
import { normalizeTurkishPhone } from "@/lib/format/phone"
import { isValidEmail } from "@/lib/validation/email"

export type PatientImportRow = {
  rowNumber: number
  fullName: string
  phone: string
  email: string | null
  dateOfBirth: string | null
}

export type PatientImportRowError = {
  rowNumber: number
  message: string
}

export type PatientImportPreview = {
  validRows: PatientImportRow[]
  errors: PatientImportRowError[]
  totalRows: number
}

const HEADER_ALIASES: Record<string, string> = {
  "ad soyad": "fullName",
  "adı soyadı": "fullName",
  telefon: "phone",
  "e-posta": "email",
  eposta: "email",
  email: "email",
  "doğum tarihi": "dateOfBirth",
}

/** yyyy-mm-dd, dd.mm.yyyy, or dd/mm/yyyy — the formats a secretary is likely to type or paste from Excel. */
function normalizeDateOfBirth(raw: string): string | null {
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

/**
 * Reads an uploaded .xlsx and returns a preview (valid rows + per-row
 * errors) — never commits anything, same two-step pattern as
 * `parseLeadsWorkbook` (lib/leads/import.ts). Written in parallel rather
 * than sharing that function directly: the field set and validation rules
 * are genuinely different (no source/status, has date of birth), so forcing
 * one generic parser would need a configuration layer that costs more than
 * the ~60 duplicated lines.
 */
export async function parsePatientsWorkbook(buffer: Buffer): Promise<PatientImportPreview> {
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

  if (![...columnMap.values()].includes("fullName")) {
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

  const validRows: PatientImportRow[] = []
  const errors: PatientImportRowError[] = []
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

    const fullName = values.fullName ?? ""
    if (!fullName) {
      errors.push({ rowNumber, message: "Ad Soyad boş olamaz." })
      return
    }

    const phone = normalizeTurkishPhone(values.phone ?? "")
    if (!phone) {
      errors.push({ rowNumber, message: "Telefon numarası geçersiz (10 haneli olmalı)." })
      return
    }

    const email = values.email?.trim() || null
    if (email && !isValidEmail(email)) {
      errors.push({ rowNumber, message: "E-posta adresi geçersiz." })
      return
    }

    let dateOfBirth: string | null = null
    if (values.dateOfBirth?.trim()) {
      dateOfBirth = normalizeDateOfBirth(values.dateOfBirth)
      if (!dateOfBirth) {
        errors.push({ rowNumber, message: "Doğum tarihi geçersiz (GG.AA.YYYY veya YYYY-AA-GG)." })
        return
      }
    }

    validRows.push({
      rowNumber,
      fullName,
      phone,
      email,
      dateOfBirth,
    })
  })

  return { validRows, errors, totalRows }
}

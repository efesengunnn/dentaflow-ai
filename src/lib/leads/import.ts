import { Workbook } from "exceljs"

import { cellToString } from "@/lib/format/excel-cell"
import { normalizeTurkishPhone } from "@/lib/format/phone"
import { parseLeadSourceLabel, parseLeadStatusLabel } from "@/lib/leads/constants"
import type { LeadSource, LeadStatus } from "@/lib/leads/constants"
import { isValidEmail } from "@/lib/validation/email"

export type LeadImportRow = {
  rowNumber: number
  fullName: string
  phone: string
  email: string | null
  source: LeadSource
  status: LeadStatus
  assignedToName: string | null
}

export type LeadImportRowError = {
  rowNumber: number
  message: string
}

export type LeadImportPreview = {
  validRows: LeadImportRow[]
  errors: LeadImportRowError[]
  totalRows: number
}

const HEADER_ALIASES: Record<string, string> = {
  "ad soyad": "fullName",
  "adı soyadı": "fullName",
  telefon: "phone",
  "e-posta": "email",
  eposta: "email",
  email: "email",
  kaynak: "source",
  durum: "status",
  "sorumlu personel": "assignedTo",
  "atanan personel": "assignedTo", // legacy alias — older downloaded templates used this label
}

/**
 * Reads an uploaded .xlsx and returns a preview (valid rows + per-row
 * errors) — never commits anything. `commitLeadImport` (actions.ts) is a
 * separate, explicit second step once the founder/staff member has reviewed
 * this preview, matching the product's no-silent-bulk-write posture.
 */
export async function parseLeadsWorkbook(buffer: Buffer): Promise<LeadImportPreview> {
  const workbook = new Workbook()
  // exceljs's bundled types target an older `Buffer` shape than this
  // project's @types/node — structurally compatible at runtime, so a
  // narrow cast here beats loosening the function's public signature.
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

  const validRows: LeadImportRow[] = []
  const errors: LeadImportRowError[] = []
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

    const source = values.source ? (parseLeadSourceLabel(values.source) ?? "other") : "other"
    const status = values.status ? (parseLeadStatusLabel(values.status) ?? "new") : "new"

    validRows.push({
      rowNumber,
      fullName,
      phone,
      email,
      source,
      status,
      assignedToName: values.assignedTo?.trim() || null,
    })
  })

  return { validRows, errors, totalRows }
}

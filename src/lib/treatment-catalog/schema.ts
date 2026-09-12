import { z } from "zod"

import { SUPPORTED_CURRENCIES } from "@/lib/format/currency"

export const catalogItemFormSchema = z.object({
  staffId: z.string().uuid("Personel seçin."),
  treatmentType: z.string().trim().min(2, "Tedavi adı en az 2 karakter olmalı."),
  /** Optional — same "Belirlenmedi" convention as treatment_series.totalFee. */
  defaultPrice: z.number().min(0, "Fiyat negatif olamaz.").optional(),
  /** Sprint 31 — most treatments are TRY, a few (prosthetics/veneers/crowns) EUR. Required (no zod `.default`) so react-hook-form's input/output types stay identical; the form supplies "TRY" via defaultValues. */
  currency: z.enum(SUPPORTED_CURRENCIES),
})

export type CatalogItemFormValues = z.infer<typeof catalogItemFormSchema>

export const catalogItemFormDefaults: CatalogItemFormValues = {
  staffId: "",
  treatmentType: "",
  defaultPrice: undefined,
  currency: "TRY",
}

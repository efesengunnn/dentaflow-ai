import { z } from "zod"

export const catalogItemFormSchema = z.object({
  staffId: z.string().uuid("Personel seçin."),
  treatmentType: z.string().trim().min(2, "Tedavi adı en az 2 karakter olmalı."),
  /** Optional — same "Belirlenmedi" convention as treatment_series.totalFee. */
  defaultPrice: z.number().min(0, "Fiyat negatif olamaz.").optional(),
})

export type CatalogItemFormValues = z.infer<typeof catalogItemFormSchema>

export const catalogItemFormDefaults: CatalogItemFormValues = {
  staffId: "",
  treatmentType: "",
  defaultPrice: undefined,
}

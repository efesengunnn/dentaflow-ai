import { z } from "zod"

import { SUPPORTED_CURRENCIES } from "@/lib/format/currency"
import { isValidFdiNumber } from "@/lib/odontogram/fdi"

/**
 * FDI/ISO 3950 tooth numbers a plan item applies to (Sprint 33) — optional
 * everywhere: an empty/absent list means "whole-mouth / not tooth-specific".
 * 52 is the full mouth (32 permanent + 20 primary), the hard upper bound.
 */
const toothNumbersSchema = z
  .array(z.number().int())
  .max(52, "Çok fazla diş seçildi.")
  .refine((teeth) => teeth.every(isValidFdiNumber), "Geçersiz diş numarası.")
  .refine((teeth) => new Set(teeth).size === teeth.length, "Aynı diş birden fazla seçilemez.")
  .optional()

const TREATMENT_PAYMENT_METHOD_VALUES = ["cash", "credit_card", "bank_transfer", "other"] as const
const TREATMENT_PAYMENT_CORRECTION_TYPE_VALUES = ["refund", "adjustment"] as const

/**
 * These schemas back the not-yet-built `lib/treatment-plans/actions.ts`
 * Server Actions (a later step of Sprint 28) — written now so the wizard/
 * form UI has a validated contract to build against without waiting on the
 * action layer. Shapes mirror `lib/treatments/schema.ts`'s legacy
 * equivalents everywhere the underlying rule is unchanged (fee optional,
 * `null` never a fake `0`, notes/description length caps).
 */

/** One line item within a Tedavi Planı wizard submission — one provider, one treatment, a session count and optional price. */
export const treatmentPlanItemInputSchema = z.object({
  providerId: z.string().min(1, "Hekim seçin."),
  treatmentName: z.string().trim().min(1, "Tedavi adını girin.").max(120, "Tedavi adı 120 karakteri geçemez."),
  catalogItemId: z.string().optional(),
  sessionCount: z.number().int().min(1, "En az 1 seans olmalı.").max(999, "Geçerli bir seans sayısı girin."),
  /** Optional — a phone-sold plan's price may not be negotiated yet. `undefined` renders as "Belirlenmedi", never a fake `0`. */
  unitPrice: z.number().min(0, "Fiyat negatif olamaz.").optional(),
  /** Sprint 31 — item-level currency (TRY/EUR); a plan may mix currencies. Carried from the catalog item, or chosen for a custom treatment. Required so callers always state it explicitly. */
  currency: z.enum(SUPPORTED_CURRENCIES),
  /** Sprint 30.3 — planned follow-up date for this specific patient's item, set at definition time. Always patient+item specific, never a fixed per-treatment-type default. */
  controlDate: z.string().optional(),
  /** Sprint 33 — FDI tooth numbers this item targets (optional; empty = whole-mouth). */
  toothNumbers: toothNumbersSchema,
})

export type TreatmentPlanItemInput = z.infer<typeof treatmentPlanItemInputSchema>

/** "Yeni Tedavi Planı" wizard final submit — one or more providers, one or more items each. A single-session single-procedure sale is the same shape with exactly one item, `sessionCount: 1` — no separate form/mode. */
export const treatmentPlanFormSchema = z.object({
  patientId: z.string().min(1, "Hasta seçin."),
  planName: z.string().trim().min(1, "Plan adını girin.").max(160, "Plan adı 160 karakteri geçemez."),
  items: z.array(treatmentPlanItemInputSchema).min(1, "En az bir tedavi kalemi ekleyin."),
})

export type TreatmentPlanFormValues = z.infer<typeof treatmentPlanFormSchema>

export const treatmentPlanFormDefaults: TreatmentPlanFormValues = {
  patientId: "",
  planName: "",
  items: [],
}

/** "Kalemi Düzenle" — revising an existing `treatment_plan_items` row. Every structural change (session count, provider, price) increments `revision_no` in the Server Action, never here. */
export const reviseTreatmentPlanItemSchema = z.object({
  itemId: z.string().min(1),
  providerId: z.string().min(1, "Hekim seçin."),
  treatmentName: z.string().trim().min(1, "Tedavi adını girin.").max(120, "Tedavi adı 120 karakteri geçemez."),
  sessionCount: z.number().int().min(1, "En az 1 seans olmalı.").max(999, "Geçerli bir seans sayısı girin."),
  unitPrice: z.number().min(0, "Fiyat negatif olamaz.").optional(),
  /** Sprint 33 — revising which teeth an existing item targets (optional; empty = whole-mouth). */
  toothNumbers: toothNumbersSchema,
})

export type ReviseTreatmentPlanItemValues = z.infer<typeof reviseTreatmentPlanItemSchema>

/** Owner-only revenue attribution edit — kept separate from `reviseTreatmentPlanItemSchema` since it is not a structural revision and does not touch `revision_no`. */
export const setProviderShareSchema = z.object({
  itemId: z.string().min(1),
  providerShareAmount: z.number().min(0, "Tutar negatif olamaz.").optional(),
})

export type SetProviderShareValues = z.infer<typeof setProviderShareSchema>

/** "Seansı Tamamla" — a `treatment_sessions` row is only ever created at this moment, never pre-scheduled. */
export const completeSessionFormSchema = z.object({
  treatmentPlanItemId: z.string().min(1, "Tedavi kalemi seçin."),
  appointmentId: z.string().optional(),
  performedBy: z.string().min(1, "Personel seçin."),
  performedAt: z.string().min(1, "Tarih seçin."),
  controlDate: z.string().optional(),
  notes: z.string().trim().max(2000, "Not 2000 karakteri geçemez.").optional(),
})

export type CompleteSessionFormValues = z.infer<typeof completeSessionFormSchema>

/** "Seansı Düzelt" — the original session is marked `corrected` (never updated in place), a new `completed` row is inserted with the same `session_number`. `reason` is mandatory — see `treatment_sessions_state_machine_consistent`. */
export const correctSessionFormSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().trim().min(1, "Düzeltme sebebini girin.").max(500, "Sebep 500 karakteri geçemez."),
  performedBy: z.string().min(1, "Personel seçin."),
  performedAt: z.string().min(1, "Tarih seçin."),
  controlDate: z.string().optional(),
  notes: z.string().trim().max(2000, "Not 2000 karakteri geçemez.").optional(),
})

export type CorrectSessionFormValues = z.infer<typeof correctSessionFormSchema>

/** "Seansı İptal Et" — marks the row `voided` in place, no replacement row (this visit never should have counted). */
export const voidSessionFormSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().trim().min(1, "İptal sebebini girin.").max(500, "Sebep 500 karakteri geçemez."),
})

export type VoidSessionFormValues = z.infer<typeof voidSessionFormSchema>

/** "Ödeme Ekle" — always `entry_type = 'payment'`; refund/adjustment go through `treatmentPlanPaymentCorrectionSchema` instead. */
export const treatmentPlanPaymentFormSchema = z.object({
  treatmentPlanId: z.string().min(1, "Plan seçin."),
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  /** Sprint 31 — which currency this payment is in; a mixed plan owes in more than one, so the payer must say which balance this pays down. Required (form supplies it via defaultValues). */
  currency: z.enum(SUPPORTED_CURRENCIES),
  method: z.enum(TREATMENT_PAYMENT_METHOD_VALUES, { message: "Ödeme yöntemi seçin." }),
  paidAt: z.string().min(1, "Tarih seçin."),
  note: z.string().trim().max(500, "Not 500 karakteri geçemez.").optional(),
})

export type TreatmentPlanPaymentFormValues = z.infer<typeof treatmentPlanPaymentFormSchema>

/** "İade / Düzeltme" — always references the payment it corrects via `relatedPaymentId`. */
export const treatmentPlanPaymentCorrectionSchema = z.object({
  treatmentPlanId: z.string().min(1),
  relatedPaymentId: z.string().min(1, "Düzeltilecek ödemeyi seçin."),
  entryType: z.enum(TREATMENT_PAYMENT_CORRECTION_TYPE_VALUES, { message: "Düzeltme türünü seçin." }),
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  method: z.enum(TREATMENT_PAYMENT_METHOD_VALUES, { message: "Ödeme yöntemi seçin." }),
  paidAt: z.string().min(1, "Tarih seçin."),
  note: z.string().trim().max(500, "Not 500 karakteri geçemez.").optional(),
})

export type TreatmentPlanPaymentCorrectionValues = z.infer<typeof treatmentPlanPaymentCorrectionSchema>

/**
 * Sprint 28C.1 — Flexible Delete & Audit: `reason` is mandatory on every
 * soft-delete schema, matching the `deleted_at is null or (deleted_by is
 * not null and delete_reason is not null)` DB constraint on each table.
 */
export const deleteTreatmentPlanSchema = z.object({
  planId: z.string().min(1),
  reason: z.string().trim().min(1, "Silme sebebini girin.").max(500, "Sebep 500 karakteri geçemez."),
})

export type DeleteTreatmentPlanValues = z.infer<typeof deleteTreatmentPlanSchema>

export const deleteTreatmentPlanItemSchema = z.object({
  itemId: z.string().min(1),
  reason: z.string().trim().min(1, "Silme sebebini girin.").max(500, "Sebep 500 karakteri geçemez."),
})

export type DeleteTreatmentPlanItemValues = z.infer<typeof deleteTreatmentPlanItemSchema>

export const deleteTreatmentSessionSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().trim().min(1, "Silme sebebini girin.").max(500, "Sebep 500 karakteri geçemez."),
})

export type DeleteTreatmentSessionValues = z.infer<typeof deleteTreatmentSessionSchema>

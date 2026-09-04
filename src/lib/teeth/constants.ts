import type { Database } from "@/lib/supabase/database.types";

export type ToothConditionStatus = Database["public"]["Enums"]["tooth_condition_status"];
export type ToothTreatmentType = Database["public"]["Enums"]["tooth_treatment_type"];
export type ToothTreatmentStatus = Database["public"]["Enums"]["tooth_treatment_status"];

/**
 * FDI (ISO 3950) notation, permanent dentition only (32 teeth) — pediatric/
 * mixed dentition deferred, see the migration's own header comment.
 * Quadrant order matches how a dental chart is conventionally drawn facing
 * the patient: upper arch reads 18→11 then 21→28 (patient's right to
 * left), lower arch reads 48→41 then 31→38.
 */
export const UPPER_ARCH_TEETH: number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ARCH_TEETH: number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_TEETH: number[] = [...UPPER_ARCH_TEETH, ...LOWER_ARCH_TEETH];

export const TOOTH_CONDITION_LABELS: Record<ToothConditionStatus, string> = {
  saglikli: "Sağlıklı",
  curuk: "Çürük",
  dolgulu: "Dolgulu",
  kanal_tedavili: "Kanal Tedavili",
  kaplamali: "Kaplamalı",
  implant: "İmplant",
  kopru_ayagi: "Köprü Ayağı",
  eksik: "Eksik",
  gomulu: "Gömülü",
};

/** Chart fill color per condition — `saglikli`/absence share the same neutral tone. */
export const TOOTH_CONDITION_COLORS: Record<ToothConditionStatus, string> = {
  saglikli: "fill-muted stroke-border",
  curuk: "fill-destructive/70 stroke-destructive",
  dolgulu: "fill-primary/60 stroke-primary",
  kanal_tedavili: "fill-warning/70 stroke-warning",
  kaplamali: "fill-accent stroke-accent-foreground/40",
  implant: "fill-success/70 stroke-success",
  kopru_ayagi: "fill-success/40 stroke-success",
  eksik: "fill-transparent stroke-muted-foreground/40",
  gomulu: "fill-muted-foreground/30 stroke-muted-foreground",
};

export const TOOTH_TREATMENT_TYPE_LABELS: Record<ToothTreatmentType, string> = {
  muayene: "Muayene",
  dolgu: "Dolgu",
  kanal_tedavisi: "Kanal Tedavisi",
  cekim: "Çekim",
  kaplama: "Kaplama",
  implant: "İmplant",
  kopru: "Köprü",
  dis_tasi_temizligi: "Diş Taşı Temizliği",
  beyazlatma: "Beyazlatma",
  diger: "Diğer",
};

export const TOOTH_TREATMENT_TYPE_OPTIONS: { value: ToothTreatmentType; label: string }[] = (
  Object.keys(TOOTH_TREATMENT_TYPE_LABELS) as ToothTreatmentType[]
).map((value) => ({ value, label: TOOTH_TREATMENT_TYPE_LABELS[value] }));

export const TOOTH_TREATMENT_STATUS_LABELS: Record<ToothTreatmentStatus, string> = {
  planlandi: "Planlandı",
  tamamlandi: "Tamamlandı",
  iptal: "İptal Edildi",
};

export const TOOTH_TREATMENT_STATUS_OPTIONS: { value: ToothTreatmentStatus; label: string }[] = (
  Object.keys(TOOTH_TREATMENT_STATUS_LABELS) as ToothTreatmentStatus[]
).map((value) => ({ value, label: TOOTH_TREATMENT_STATUS_LABELS[value] }));

export const TOOTH_TREATMENT_STATUS_BADGE_VARIANT: Record<
  ToothTreatmentStatus,
  "secondary" | "default" | "warning" | "success" | "destructive"
> = {
  planlandi: "secondary",
  tamamlandi: "success",
  iptal: "destructive",
};

export function isValidToothNumber(value: number): boolean {
  return ALL_TEETH.includes(value);
}

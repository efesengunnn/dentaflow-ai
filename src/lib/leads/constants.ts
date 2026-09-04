import type { Database } from "@/lib/supabase/database.types";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadSource = Database["public"]["Enums"]["lead_source"];
export type LeadActivityType = Database["public"]["Enums"]["lead_activity_type"];

/**
 * Stops at the Lead->Patient boundary from PRODUCT_BLUEPRINT.md Section 11
 * (Lead -> First Consultation -> Proposal -> Patient -> Treatment...) —
 * deliberately vertical-agnostic, no treatment-stage values here. See
 * supabase/migrations/20260721150000_create_leads.sql for the full
 * reconciliation note against the original DATABASE.md pipeline.
 */
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  consultation_scheduled: "Konsültasyon Planlandı",
  proposal_sent: "Teklif Sunuldu",
  converted: "Hastaya Dönüştü",
  lost: "Kayıp",
};

export const LEAD_STATUS_BADGE_VARIANT: Record<
  LeadStatus,
  "secondary" | "default" | "warning" | "success" | "destructive"
> = {
  new: "secondary",
  contacted: "default",
  consultation_scheduled: "default",
  proposal_sent: "warning",
  converted: "success",
  lost: "destructive",
};

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = (
  Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]
).map((value) => ({ value, label: LEAD_STATUS_LABELS[value] }));

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Web Sitesi",
  referral: "Referans",
  social_media: "Sosyal Medya",
  phone_call: "Telefon",
  walk_in: "Kapıdan Gelen",
  other: "Diğer",
};

export const LEAD_SOURCE_OPTIONS: { value: LeadSource; label: string }[] = (
  Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]
).map((value) => ({ value, label: LEAD_SOURCE_LABELS[value] }));

export const LEAD_ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  lead_created: "Kayıt oluşturuldu",
  lead_updated: "Bilgiler güncellendi",
  status_changed: "Durum değiştirildi",
  note_added: "Not eklendi",
  lead_deleted: "Kayıt silindi",
};

export const LEADS_PAGE_SIZE = 20;

/**
 * Reverse label -> enum-value lookups, case/whitespace-insensitive — used by
 * Excel import to accept the same Turkish labels the UI shows (a secretary
 * types what they see on screen, not an internal enum value).
 */
function buildReverseLookup<T extends string>(labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [value, label] of Object.entries(labels) as [T, string][]) {
    map.set(label.trim().toLocaleLowerCase("tr"), value);
  }
  return map;
}

const LEAD_STATUS_BY_LABEL = buildReverseLookup(LEAD_STATUS_LABELS);
const LEAD_SOURCE_BY_LABEL = buildReverseLookup(LEAD_SOURCE_LABELS);

export function parseLeadStatusLabel(label: string): LeadStatus | undefined {
  return LEAD_STATUS_BY_LABEL.get(label.trim().toLocaleLowerCase("tr"));
}

export function parseLeadSourceLabel(label: string): LeadSource | undefined {
  return LEAD_SOURCE_BY_LABEL.get(label.trim().toLocaleLowerCase("tr"));
}

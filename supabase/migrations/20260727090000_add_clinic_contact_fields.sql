-- Sprint 26: Klinik Ayarları — lets an owner fill in their clinic's public/contact
-- details from Ayarlar > Klinik. All nullable free text: business_hours stays a
-- human-readable string ("Pazartesi-Cuma 09:00-18:00") rather than a structured
-- schedule model, and logo_url is a pasted URL rather than Supabase Storage upload
-- infrastructure — both deliberately out of scope for this sprint (see Sprint 26
-- report). No RLS change: clinics_update_owner already covers UPDATE on any column.

alter table public.clinics
  add column phone text,
  add column email text,
  add column address text,
  add column logo_url text,
  add column business_hours text;

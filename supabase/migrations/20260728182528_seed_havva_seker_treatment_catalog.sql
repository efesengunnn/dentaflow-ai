-- Founder-provided catalog for Havva Şeker (beauty_specialist), 2026-07-28
-- — same "no price yet" convention as Dr. Alparslan Tekiner's seed
-- (20260728175942), fillable via Ayarlar > Tedavi Kataloğu.
--
-- Same environment guard as 20260728175942 — production-only UUIDs, no-op
-- anywhere those rows don't exist (local dev, CI, a fresh clone).

insert into public.staff_treatment_catalog_items (clinic_id, staff_id, treatment_type)
select
  '9273df89-fc11-468a-bf1c-e8b752d7aac4'::uuid,
  '4814b386-8ed1-4222-92ec-abad749fde87'::uuid,
  treatment_name
from (
  values
    ('İğneli Epilasyon'), ('HİFU'), ('Altın İğne'), ('Dermapen'),
    ('Cold Plazma'), ('Lazer Epilasyon'), ('Bölgesel İncelme')
) as seed(treatment_name)
where exists (select 1 from public.clinics where id = '9273df89-fc11-468a-bf1c-e8b752d7aac4'::uuid)
  and exists (select 1 from public.staff_members where id = '4814b386-8ed1-4222-92ec-abad749fde87'::uuid)
on conflict (staff_id, treatment_type) do nothing;

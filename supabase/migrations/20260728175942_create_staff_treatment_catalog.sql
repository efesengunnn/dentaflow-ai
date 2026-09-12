-- Founder decision (2026-07-28): a per-staff treatment catalog with an
-- optional default price, so booking an appointment can offer "what will
-- happen" as a pick-list instead of re-typing it from scratch when
-- starting the treatment separately. Deliberately per staff_id (not per
-- role) — the founder's own call, since two doctors could offer different
-- procedures. Owner-only write (Ayarlar-managed); everyone in the clinic
-- can read it (needed to populate the picker when booking). treatment_type
-- stays free text on treatment_series itself (Sprint 7's "no
-- vertical-specific code" principle, unchanged) — this catalog is an
-- assistive suggestion layer, not a closed enum; a custom/free-text entry
-- on the appointment form remains possible regardless of what's cataloged.
--
-- Never hard-deleted, same "deactivate instead" convention as
-- staff_members — a catalog item might be referenced only by name in past
-- treatment_series rows (treatment_type is a text snapshot, not a FK), so
-- removing an item from the picker shouldn't touch history anyway.

create table public.staff_treatment_catalog_items (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  staff_id uuid not null references public.staff_members (id),
  treatment_type text not null,
  default_price numeric(10, 2),
  is_active boolean not null default true,
  created_by uuid references public.staff_members (id),
  updated_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, treatment_type)
);

comment on table public.staff_treatment_catalog_items is
  'Per-staff picklist of treatments + an optional suggested price, used to pre-fill the appointment-booking treatment section. Owner-managed via Ayarlar. Not a closed enum — treatment_series.treatment_type stays free text.';

create index staff_treatment_catalog_items_staff_id_idx on public.staff_treatment_catalog_items (staff_id);

create trigger staff_treatment_catalog_items_set_audit_columns
  before insert or update on public.staff_treatment_catalog_items
  for each row execute function public.set_audit_columns();

alter table public.staff_treatment_catalog_items enable row level security;

grant select, insert, update on public.staff_treatment_catalog_items to authenticated;

create policy staff_treatment_catalog_items_select_own_clinic on public.staff_treatment_catalog_items
  for select
  using (clinic_id = public.current_clinic_id());

create policy staff_treatment_catalog_items_insert_owner_only on public.staff_treatment_catalog_items
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  );

create policy staff_treatment_catalog_items_update_owner_only on public.staff_treatment_catalog_items
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  )
  with check (clinic_id = public.current_clinic_id());

-- Seed Dt. Ayten Altındağ's real catalog (founder-provided list,
-- 2026-07-28) — no default_price yet ("Belirlenmedi", same convention as
-- treatment_series.total_fee), the founder will fill prices in via the
-- new Ayarlar screen once it ships.
--
-- Guarded with an `exists` check on the referenced clinic/staff row:
-- these are production-only UUIDs, so on any other environment (local
-- dev, CI, a fresh clone) the FK would otherwise fail this whole migration
-- outright. On production, where the rows exist, this is a no-op change —
-- the migration already ran there before this guard was added.
insert into public.staff_treatment_catalog_items (clinic_id, staff_id, treatment_type)
select
  '9273df89-fc11-468a-bf1c-e8b752d7aac4'::uuid,
  '51113328-58c9-46e0-9e51-fa1051f1f0f0'::uuid,
  treatment_name
from (
  values
    ('Dolgu'), ('Mezoterapi'), ('PRP'), ('Sıvı Yüz Germe'),
    ('Mineral Aşı'), ('Fransız Askı'), ('Botox'), ('Gençlik Aşısı'),
    ('Lifting Aşı'), ('Eksozom'), ('Somon DNA'), ('Endolift'), ('Lipoliz')
) as seed(treatment_name)
where exists (select 1 from public.clinics where id = '9273df89-fc11-468a-bf1c-e8b752d7aac4'::uuid)
  and exists (select 1 from public.staff_members where id = '51113328-58c9-46e0-9e51-fa1051f1f0f0'::uuid)
on conflict (staff_id, treatment_type) do nothing;

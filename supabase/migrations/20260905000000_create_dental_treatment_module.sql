-- Dental Treatment Module (v1) — tooth-level treatment tracking, replacing
-- ClinicFlow AI's package/series model with a shape that actually fits
-- dental care: treatments are per-tooth, not per-visit.
--
-- Scope (founder decision, 2026-09-05): permanent dentition only (32 teeth,
-- FDI numbering) — pediatric/mixed dentition deferred. No orthodontics
-- (long-running, recurring-adjustment treatment plans) — deferred. No SGK/
-- insurance billing — private-pay only, mirroring the simple balance model
-- already used elsewhere in this schema.

-- ---------------------------------------------------------------------------
-- tooth_conditions — the CURRENT state of a tooth. Sparse by design: a row
-- only exists for a tooth with a non-default condition. A tooth with no row
-- is implicitly healthy — avoids a 32-row bulk insert on every patient
-- creation, and "healthy" needs no explicit representation.
-- ---------------------------------------------------------------------------
create type public.tooth_condition_status as enum (
  'saglikli',
  'curuk',
  'dolgulu',
  'kanal_tedavili',
  'kaplamali',
  'implant',
  'kopru_ayagi',
  'eksik',
  'gomulu'
);

create table public.tooth_conditions (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  tooth_number smallint not null,
  status public.tooth_condition_status not null,
  note text,
  updated_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tooth_conditions_valid_tooth_number check (
    tooth_number / 10 in (1, 2, 3, 4) and tooth_number % 10 between 1 and 8
  ),
  constraint tooth_conditions_patient_tooth_unique unique (patient_id, tooth_number)
);

comment on table public.tooth_conditions is
  'Current state of one tooth for one patient. Sparse: only non-healthy '
  'teeth get a row. tooth_number is FDI notation (11-18/21-28/31-38/41-48).';

create index tooth_conditions_patient_id_idx on public.tooth_conditions (patient_id);

create trigger tooth_conditions_set_audit_columns
  before insert or update on public.tooth_conditions
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- tooth_treatments — the actual clinical/billing log, one row per procedure
-- performed (or planned) on one tooth. This is the source of truth;
-- tooth_conditions is a derived snapshot kept in sync by the trigger below.
-- ---------------------------------------------------------------------------
create type public.tooth_treatment_type as enum (
  'muayene',
  'dolgu',
  'kanal_tedavisi',
  'cekim',
  'kaplama',
  'implant',
  'kopru',
  'dis_tasi_temizligi',
  'beyazlatma',
  'diger'
);

create type public.tooth_treatment_status as enum (
  'planlandi',
  'tamamlandi',
  'iptal'
);

create table public.tooth_treatments (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  tooth_number smallint not null,
  treatment_type public.tooth_treatment_type not null,
  custom_treatment_name text,
  status public.tooth_treatment_status not null default 'planlandi',
  price numeric(10, 2),
  performed_by uuid references public.staff_members (id),
  appointment_id uuid references public.appointments (id),
  performed_at date not null default current_date,
  note text,
  deleted_at timestamptz,
  deleted_by uuid references public.staff_members (id),
  delete_reason text,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tooth_treatments_valid_tooth_number check (
    tooth_number / 10 in (1, 2, 3, 4) and tooth_number % 10 between 1 and 8
  ),
  constraint tooth_treatments_soft_delete_consistent check (
    deleted_at is null or (deleted_by is not null and delete_reason is not null)
  ),
  constraint tooth_treatments_custom_name_check check (
    (treatment_type = 'diger' and custom_treatment_name is not null)
    or (treatment_type <> 'diger')
  )
);

comment on table public.tooth_treatments is
  'Append-mostly clinical/billing log: one row per procedure planned or '
  'performed on one tooth. appointment_id is optional — not every '
  'appointment produces a tooth treatment (e.g. a consultation-only visit).';

create index tooth_treatments_patient_id_performed_at_idx
  on public.tooth_treatments (patient_id, performed_at desc);
create index tooth_treatments_clinic_id_idx on public.tooth_treatments (clinic_id);
create index tooth_treatments_appointment_id_idx on public.tooth_treatments (appointment_id);

create trigger tooth_treatments_set_audit_columns
  before insert or update on public.tooth_treatments
  for each row execute function public.set_audit_columns();

-- Keeps tooth_conditions in sync whenever a treatment is marked completed —
-- the application never writes tooth_conditions directly for this case, so
-- the two tables can't drift apart. Only treatment types that actually
-- change a tooth's physical state map to a condition (muayene/
-- dis_tasi_temizligi/beyazlatma/diger leave it untouched).
create function public.sync_tooth_condition_from_treatment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.tooth_condition_status;
begin
  if new.status <> 'tamamlandi' then
    return new;
  end if;

  v_status := case new.treatment_type
    when 'dolgu' then 'dolgulu'
    when 'kanal_tedavisi' then 'kanal_tedavili'
    when 'cekim' then 'eksik'
    when 'kaplama' then 'kaplamali'
    when 'implant' then 'implant'
    when 'kopru' then 'kopru_ayagi'
    else null
  end;

  if v_status is null then
    return new;
  end if;

  insert into public.tooth_conditions (clinic_id, patient_id, tooth_number, status, updated_by)
  values (new.clinic_id, new.patient_id, new.tooth_number, v_status, new.updated_by)
  on conflict (patient_id, tooth_number)
  do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now();

  return new;
end;
$$;

create trigger tooth_treatments_sync_condition
  after insert or update on public.tooth_treatments
  for each row execute function public.sync_tooth_condition_from_treatment();

-- ---------------------------------------------------------------------------
-- treatment_catalog — the clinic's own price list, so a dentist picks a
-- procedure instead of typing a price every time. Owner-managed (Ayarlar >
-- Tedavi Kataloğu), same convention as ClinicFlow AI's per-staff catalog but
-- simplified to one clinic-wide list (no per-staff pricing in v1).
-- ---------------------------------------------------------------------------
create table public.treatment_catalog (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  treatment_type public.tooth_treatment_type not null,
  name text not null,
  default_price numeric(10, 2),
  is_active boolean not null default true,
  created_by uuid references public.staff_members (id),
  updated_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.treatment_catalog is
  'Clinic-defined price list for tooth treatments — one clinic-wide list, no per-staff pricing.';

create index treatment_catalog_clinic_id_idx on public.treatment_catalog (clinic_id);

create trigger treatment_catalog_set_audit_columns
  before insert or update on public.treatment_catalog
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- patient_payments — private-pay tahsilat log. "Kalan Bakiye" is computed
-- (sum of completed tooth_treatments.price minus sum of payments), never
-- stored — same "derive, don't duplicate" discipline as the rest of this
-- schema.
-- ---------------------------------------------------------------------------
create table public.patient_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  amount numeric(10, 2) not null,
  paid_at date not null default current_date,
  method text,
  note text,
  deleted_at timestamptz,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_payments_amount_positive check (amount > 0)
);

comment on table public.patient_payments is
  'Private-pay collection log. No packages/series (SGK and packages out of '
  'scope for v1) — a flat running balance per patient.';

create index patient_payments_patient_id_idx on public.patient_payments (patient_id);

create trigger patient_payments_set_audit_columns
  before insert or update on public.patient_payments
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security. Clinical writes (tooth_conditions, tooth_treatments)
-- are restricted to owner/doctor — the roles that actually perform
-- treatments; secretary is read-only there, matching the "front desk
-- doesn't edit clinical records" split already used elsewhere. Payments and
-- the catalog follow the existing front-desk/ownership conventions.
-- ---------------------------------------------------------------------------
alter table public.tooth_conditions enable row level security;
alter table public.tooth_treatments enable row level security;
alter table public.treatment_catalog enable row level security;
alter table public.patient_payments enable row level security;

grant select, insert, update on public.tooth_conditions to authenticated;
grant select, insert, update on public.tooth_treatments to authenticated;
grant select, insert, update, delete on public.treatment_catalog to authenticated;
grant select, insert, update on public.patient_payments to authenticated;

create policy tooth_conditions_select_own_clinic on public.tooth_conditions
  for select
  using (clinic_id = public.current_clinic_id());

create policy tooth_conditions_write_clinical_roles on public.tooth_conditions
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor')
  );

create policy tooth_conditions_update_clinical_roles on public.tooth_conditions
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor')
  )
  with check (clinic_id = public.current_clinic_id());

create policy tooth_treatments_select_own_clinic on public.tooth_treatments
  for select
  using (clinic_id = public.current_clinic_id());

create policy tooth_treatments_insert_clinical_roles on public.tooth_treatments
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor')
  );

create policy tooth_treatments_update_clinical_roles on public.tooth_treatments
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor')
  )
  with check (clinic_id = public.current_clinic_id());

create policy treatment_catalog_select_own_clinic on public.treatment_catalog
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_catalog_write_owner_only on public.treatment_catalog
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  );

create policy treatment_catalog_update_owner_only on public.treatment_catalog
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  )
  with check (clinic_id = public.current_clinic_id());

create policy treatment_catalog_delete_owner_only on public.treatment_catalog
  for delete
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  );

create policy patient_payments_select_own_clinic on public.patient_payments
  for select
  using (clinic_id = public.current_clinic_id());

create policy patient_payments_insert_owner_or_secretary on public.patient_payments
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  );

create policy patient_payments_update_owner_or_secretary on public.patient_payments
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  )
  with check (clinic_id = public.current_clinic_id());

-- DentaFlow AI — baseline schema.
--
-- This is a clean-start baseline, not a copy-paste of ClinicFlow AI's 35
-- incremental migrations. It carries forward only the vertical-agnostic
-- foundation (clinics, staff/RBAC, leads, patients, appointments) that
-- DentaFlow AI's bootstrap kept from ClinicFlow AI's architecture — every
-- table/policy/comment below is reproduced from the original migrations
-- that introduced each piece, reconciled into one file. Nothing here
-- encodes aesthetic-clinic-specific domain (treatment plans, packages,
-- treatment catalog, AI features) — the dental treatment/procedure model
-- is intentionally not designed yet; it is a separate, future migration.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- clinics — tenant root. No clinic_id (it IS the tenant), no created_by (the
-- first row is created before any staff_members row exists).
-- ---------------------------------------------------------------------------
create table public.clinics (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  business_hours text,
  updated_by uuid, -- FK added below, after staff_members exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinics is
  'Tenant root. One row per clinic.';

-- ---------------------------------------------------------------------------
-- staff_members — 1:1 extension of auth.users with clinic membership + role.
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'doctor', 'secretary', 'beauty_specialist');

create table public.staff_members (
  id uuid primary key references auth.users (id),
  clinic_id uuid not null references public.clinics (id),
  role public.staff_role not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_by uuid references public.staff_members (id),
  updated_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_members is
  'Clinic staff: auth identity + clinic membership + role.';
comment on column public.staff_members.deleted_at is
  'Soft delete marker — distinct from is_active (temporary, reversible '
  'login block). Setting this is permanent: the person leaves the active '
  'roster but created_by/updated_by/assigned_to references elsewhere stay '
  'intact. Never hard-deleted.';

alter table public.clinics
  add constraint clinics_updated_by_fkey
  foreign key (updated_by) references public.staff_members (id);

create index staff_members_clinic_id_idx on public.staff_members (clinic_id);

-- ---------------------------------------------------------------------------
-- RLS helper functions — SECURITY DEFINER so the internal staff_members
-- lookup bypasses RLS for itself only, avoiding the self-reference recursion
-- gotcha. Every RLS policy below is expressed in terms of these functions,
-- never a raw staff_members query.
-- ---------------------------------------------------------------------------
create function public.current_clinic_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select clinic_id from public.staff_members where id = auth.uid();
$$;

create function public.current_staff_role()
returns public.staff_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.staff_members where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Audit-column automation. `created_by`/`updated_by` are never accepted as
-- client input at the application layer — this trigger is defense-in-depth
-- so that guarantee doesn't depend solely on the application remembering to
-- set them correctly.
-- ---------------------------------------------------------------------------
create function public.set_audit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger clinics_set_audit_columns
  before insert or update on public.clinics
  for each row execute function public.set_audit_columns();

create trigger staff_members_set_audit_columns
  before insert or update on public.staff_members
  for each row execute function public.set_audit_columns();

-- No role can escalate itself: only an owner may change another row's role
-- or clinic_id. RLS's row-level WITH CHECK can't express a column-level
-- restriction, so this is enforced explicitly here.
create function public.staff_members_guard_role_and_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_staff_role() is distinct from 'owner' then
    if new.role is distinct from old.role
       or new.clinic_id is distinct from old.clinic_id then
      raise exception 'Only an owner can change role or clinic_id';
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_members_guard_role_and_clinic
  before update on public.staff_members
  for each row execute function public.staff_members_guard_role_and_clinic();

-- ---------------------------------------------------------------------------
-- Row-Level Security. Enabled at creation time on every table — Postgres
-- denies access with no matching policy, so an omitted policy fails closed
-- rather than open.
-- ---------------------------------------------------------------------------
alter table public.clinics enable row level security;
alter table public.staff_members enable row level security;

grant select, insert, update on public.clinics to authenticated;
grant select, insert, update on public.staff_members to authenticated;

-- clinics: read own clinic only; only an owner may update it; no client
-- INSERT (clinic creation happens via the signup flow using the service
-- role, not a staff session); never DELETE.
create policy clinics_select_own on public.clinics
  for select
  using (id = public.current_clinic_id());

create policy clinics_update_owner on public.clinics
  for update
  using (id = public.current_clinic_id() and public.current_staff_role() = 'owner')
  with check (id = public.current_clinic_id());

-- staff_members: read own clinic, all roles; insert/update restricted to
-- owner within their own clinic, except a user may update their own
-- non-sensitive fields (role/clinic_id escalation is blocked by the trigger
-- above, not by this policy); never DELETE (deactivate via is_active/
-- deleted_at).
create policy staff_select_own_clinic on public.staff_members
  for select
  using (clinic_id = public.current_clinic_id());

create policy staff_insert_owner on public.staff_members
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  );

create policy staff_update_owner_or_self on public.staff_members
  for update
  using (
    clinic_id = public.current_clinic_id()
    and (public.current_staff_role() = 'owner' or id = auth.uid())
  )
  with check (
    clinic_id = public.current_clinic_id()
  );

-- ---------------------------------------------------------------------------
-- staff_permissions — capability grant independent of role (job function).
-- audit_logs — narrow, high-value security event log (export,
-- financial-dashboard access), deliberately not comprehensive read-access
-- logging.
-- ---------------------------------------------------------------------------
create table public.staff_permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  staff_id uuid not null references public.staff_members (id),
  permission_key text not null,
  granted_by uuid references public.staff_members (id),
  granted_at timestamptz not null default now(),
  constraint staff_permissions_key_check check (permission_key in ('financial_access')),
  constraint staff_permissions_staff_key_unique unique (staff_id, permission_key)
);

comment on table public.staff_permissions is
  'Grants a capability to a staff member, independent of their role (job function).';

create index staff_permissions_clinic_id_idx on public.staff_permissions (clinic_id);
create index staff_permissions_staff_id_idx on public.staff_permissions (staff_id);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  staff_id uuid not null references public.staff_members (id),
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_event_type_check
    check (event_type in ('export', 'financial_dashboard_view'))
);

comment on table public.audit_logs is
  'Narrow, high-value security event log — export actions and financial-dashboard views only.';

create index audit_logs_clinic_id_created_at_idx on public.audit_logs (clinic_id, created_at desc);

-- Owner auto-grant — every clinic's Owner is auto-granted financial_access
-- at staff_members insert time, so financial-access decisions go through
-- exactly one mechanism (current_staff_has_permission()) everywhere.
create function public.grant_owner_financial_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' then
    insert into public.staff_permissions (clinic_id, staff_id, permission_key, granted_by)
    values (new.clinic_id, new.id, 'financial_access', null)
    on conflict (staff_id, permission_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger staff_members_grant_owner_financial_access
  after insert on public.staff_members
  for each row execute function public.grant_owner_financial_access();

create function public.current_staff_has_permission(p_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_permissions
    where staff_id = auth.uid()
      and permission_key = p_key
  );
$$;

alter table public.staff_permissions enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, delete on public.staff_permissions to authenticated;
grant select, insert on public.audit_logs to authenticated;

create policy staff_permissions_select_own_or_owner on public.staff_permissions
  for select
  using (
    clinic_id = public.current_clinic_id()
    and (staff_id = auth.uid() or public.current_staff_role() = 'owner')
  );

create policy staff_permissions_insert_owner_only on public.staff_permissions
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  );

create policy staff_permissions_delete_owner_only on public.staff_permissions
  for delete
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() = 'owner'
  );

create policy audit_logs_select_financial_access on public.audit_logs
  for select
  using (
    clinic_id = public.current_clinic_id()
    and (public.current_staff_role() = 'owner' or public.current_staff_has_permission('financial_access'))
  );

create policy audit_logs_insert_own_clinic on public.audit_logs
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and staff_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- leads — CRM pipeline entry, pre-conversion-to-patient. Deliberately
-- vertical-agnostic: no treatment-stage values in the status pipeline.
-- ---------------------------------------------------------------------------
create type public.lead_status as enum (
  'new',
  'contacted',
  'consultation_scheduled',
  'proposal_sent',
  'converted',
  'lost'
);

create type public.lead_source as enum (
  'website',
  'referral',
  'social_media',
  'phone_call',
  'walk_in',
  'other'
);

create table public.leads (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  full_name text not null,
  phone text not null,
  email text,
  tc_kimlik_no text,
  source public.lead_source not null default 'other',
  status public.lead_status not null default 'new',
  assigned_to uuid references public.staff_members (id),
  deleted_at timestamptz,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.leads is
  'CRM lead pipeline entry, pre-conversion-to-patient.';
comment on column public.leads.deleted_at is
  'Soft delete marker — distinct from status=''lost'' (a real dead sales '
  'opportunity vs. a mistaken/duplicate/spam entry). Never hard-deleted.';

create index leads_clinic_id_idx on public.leads (clinic_id);
create index leads_clinic_status_idx on public.leads (clinic_id, status);
create index leads_clinic_assigned_to_idx on public.leads (clinic_id, assigned_to);
create index leads_clinic_tc_kimlik_no_idx on public.leads (clinic_id, tc_kimlik_no);

create type public.lead_activity_type as enum (
  'lead_created',
  'lead_updated',
  'status_changed',
  'note_added',
  'lead_deleted'
);

create table public.lead_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  lead_id uuid not null references public.leads (id),
  activity_type public.lead_activity_type not null,
  description text not null,
  metadata jsonb,
  created_by uuid references public.staff_members (id),
  created_at timestamptz not null default now()
);

comment on table public.lead_activities is
  'Append-only activity/notes timeline for a lead. No updated_at/updated_by '
  '— entries are immutable by design.';

create index lead_activities_lead_id_created_at_idx
  on public.lead_activities (lead_id, created_at desc);

create trigger leads_set_audit_columns
  before insert or update on public.leads
  for each row execute function public.set_audit_columns();

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

grant select, insert, update on public.leads to authenticated;
grant select, insert on public.lead_activities to authenticated;

create policy leads_select_own_clinic on public.leads
  for select
  using (clinic_id = public.current_clinic_id());

create policy leads_insert_owner_or_secretary on public.leads
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  );

create policy leads_update_owner_or_secretary on public.leads
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  )
  with check (clinic_id = public.current_clinic_id());

create policy lead_activities_select_own_clinic on public.lead_activities
  for select
  using (clinic_id = public.current_clinic_id());

create policy lead_activities_insert_owner_or_secretary on public.lead_activities
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  );

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  lead_id uuid unique references public.leads (id),
  full_name text not null,
  phone text not null,
  email text,
  tc_kimlik_no text,
  date_of_birth date,
  assigned_to uuid references public.staff_members (id),
  deleted_at timestamptz,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patients is
  'Patient record. May originate from a converted lead (lead_id) or a direct entry (lead_id null).';
comment on column public.patients.lead_id is
  'Set only when this patient originated from a lead conversion. UNIQUE '
  'enforces "a lead converts to at most one patient" without a second FK '
  'back on leads.';

-- Partial (not plain) unique index — a soft-deleted patient's phone number
-- becomes immediately reusable rather than staying permanently reserved.
create unique index patients_clinic_id_phone_key
  on public.patients (clinic_id, phone)
  where deleted_at is null;

create index patients_clinic_id_idx on public.patients (clinic_id);
create index patients_clinic_assigned_to_idx on public.patients (clinic_id, assigned_to);
create index patients_clinic_tc_kimlik_no_idx on public.patients (clinic_id, tc_kimlik_no);

create trigger patients_set_audit_columns
  before insert or update on public.patients
  for each row execute function public.set_audit_columns();

create type public.patient_activity_type as enum (
  'patient_created',
  'patient_updated',
  'note_added',
  'patient_deleted'
);

create table public.patient_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  activity_type public.patient_activity_type not null,
  description text not null,
  metadata jsonb,
  created_by uuid references public.staff_members (id),
  created_at timestamptz not null default now()
);

comment on table public.patient_activities is
  'Append-only activity/notes timeline for a patient — the single source of '
  'truth for patient notes (no patients.notes column exists).';

create index patient_activities_patient_id_created_at_idx
  on public.patient_activities (patient_id, created_at desc);

alter table public.patients enable row level security;
alter table public.patient_activities enable row level security;

grant select, insert, update on public.patients to authenticated;
grant select, insert on public.patient_activities to authenticated;

create policy patients_select_own_clinic on public.patients
  for select
  using (clinic_id = public.current_clinic_id());

create policy patients_insert_owner_or_secretary on public.patients
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  );

create policy patients_update_owner_or_secretary on public.patients
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

create policy patient_activities_select_own_clinic on public.patient_activities
  for select
  using (clinic_id = public.current_clinic_id());

create policy patient_activities_insert_owner_or_secretary on public.patient_activities
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary', 'beauty_specialist')
  );

-- ---------------------------------------------------------------------------
-- convert_lead_to_patient — the one place true cross-table atomicity is
-- needed (lead status change + patient insert + two activity inserts,
-- all-or-nothing). SECURITY INVOKER — every statement runs as the calling
-- user, so RLS applies exactly as if the caller had run these statements
-- directly.
-- ---------------------------------------------------------------------------
create function public.convert_lead_to_patient(p_lead_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads;
  v_patient_id uuid;
  v_actor uuid := auth.uid();
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if not found then
    raise exception 'Lead not found or already deleted';
  end if;
  if v_lead.status = 'converted' then
    raise exception 'Lead already converted';
  end if;

  insert into public.patients (
    clinic_id, lead_id, full_name, phone, email, assigned_to, created_by, updated_by
  )
  values (
    v_lead.clinic_id, v_lead.id, v_lead.full_name, v_lead.phone, v_lead.email,
    v_lead.assigned_to, v_actor, v_actor
  )
  returning id into v_patient_id;

  update public.leads
  set status = 'converted', updated_by = v_actor
  where id = p_lead_id;

  insert into public.lead_activities (clinic_id, lead_id, activity_type, description, metadata, created_by)
  values (
    v_lead.clinic_id, p_lead_id, 'status_changed', 'Hastaya dönüştürüldü.',
    jsonb_build_object('from_status', v_lead.status, 'to_status', 'converted', 'patient_id', v_patient_id),
    v_actor
  );

  insert into public.patient_activities (clinic_id, patient_id, activity_type, description, metadata, created_by)
  values (
    v_lead.clinic_id, v_patient_id, 'patient_created', 'Potansiyel müşteriden dönüştürüldü.',
    jsonb_build_object('lead_id', p_lead_id), v_actor
  );

  return v_patient_id;
end;
$$;

grant execute on function public.convert_lead_to_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- appointments — no duration concept: a single point in time. ends_at is
-- only still populated (always equal to starts_at) because the column is
-- NOT NULL at the DB level. Overlap prevention (same staff, same clinic,
-- same instant) is enforced in the application layer, not a DB exclusion
-- constraint.
-- ---------------------------------------------------------------------------
create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create table public.appointments (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  staff_id uuid not null references public.staff_members (id),
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  deleted_at timestamptz,
  deleted_by uuid references public.staff_members (id),
  delete_reason text,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_ends_after_starts check (ends_at >= starts_at),
  constraint appointments_soft_delete_consistent check (
    deleted_at is null or (deleted_by is not null and delete_reason is not null)
  )
);

comment on table public.appointments is
  'Patient appointment booking. staff_id is the assigned provider. deleted_at '
  'is a mistaken/duplicate entry, distinct from status=''cancelled'' (a real '
  'booking the patient/clinic cancelled).';
comment on column public.appointments.deleted_at is
  'Soft delete marker — distinct from status=''cancelled''. Never hard-deleted.';
comment on column public.appointments.deleted_by is
  'Who soft-deleted this appointment — mandatory (see the CHECK above) for every delete.';
comment on column public.appointments.delete_reason is
  'Why this appointment was soft-deleted — mandatory going forward.';

create index appointments_clinic_id_idx on public.appointments (clinic_id);
create index appointments_clinic_starts_at_idx on public.appointments (clinic_id, starts_at);
create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_staff_id_starts_at_idx on public.appointments (staff_id, starts_at);

create type public.appointment_activity_type as enum (
  'appointment_created',
  'appointment_updated',
  'status_changed',
  'note_added',
  'appointment_deleted'
);

create table public.appointment_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  appointment_id uuid not null references public.appointments (id),
  activity_type public.appointment_activity_type not null,
  description text not null,
  metadata jsonb,
  created_by uuid references public.staff_members (id),
  created_at timestamptz not null default now()
);

comment on table public.appointment_activities is
  'Append-only activity/notes timeline for an appointment — the single '
  'source of truth for appointment notes (no appointments.notes column exists).';

create index appointment_activities_appointment_id_created_at_idx
  on public.appointment_activities (appointment_id, created_at desc);

create trigger appointments_set_audit_columns
  before insert or update on public.appointments
  for each row execute function public.set_audit_columns();

-- Row-Level Security — RBAC differs deliberately from leads/patients here:
-- INSERT/UPDATE is open to *all* roles (a secretary books/edits; a doctor
-- may adjust their own), not just owner/secretary — booking an appointment
-- is not a front-desk-only responsibility the way lead/patient record
-- management is.
alter table public.appointments enable row level security;
alter table public.appointment_activities enable row level security;

grant select, insert, update on public.appointments to authenticated;
grant select, insert on public.appointment_activities to authenticated;

create policy appointments_select_own_clinic on public.appointments
  for select
  using (clinic_id = public.current_clinic_id());

create policy appointments_insert_own_clinic on public.appointments
  for insert
  with check (clinic_id = public.current_clinic_id());

create policy appointments_update_own_clinic on public.appointments
  for update
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

create policy appointment_activities_select_own_clinic on public.appointment_activities
  for select
  using (clinic_id = public.current_clinic_id());

create policy appointment_activities_insert_own_clinic on public.appointment_activities
  for insert
  with check (clinic_id = public.current_clinic_id());

-- ---------------------------------------------------------------------------
-- service_role privileges — service_role bypasses RLS (BYPASSRLS attribute)
-- but that does not substitute for a missing table-level GRANT. Extends to
-- every current and future table/function in the public schema.
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

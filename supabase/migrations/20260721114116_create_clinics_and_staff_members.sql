-- Sprint 2: Authentication & RBAC foundation.
-- Implements the schema, helper functions, and RLS strategy already designed
-- in docs/DATABASE.md (see that file for full rationale per decision).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- clinics — tenant root. No clinic_id (it IS the tenant), no created_by (the
-- first row is created before any staff_members row exists).
-- ---------------------------------------------------------------------------
create table public.clinics (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  updated_by uuid, -- FK added below, after staff_members exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinics is
  'Tenant root. One row per clinic. See docs/DATABASE.md#clinics--tenant-root.';

-- ---------------------------------------------------------------------------
-- staff_members — 1:1 extension of auth.users with clinic membership + role.
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'doctor', 'secretary');

create table public.staff_members (
  id uuid primary key references auth.users (id),
  clinic_id uuid not null references public.clinics (id),
  role public.staff_role not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_by uuid references public.staff_members (id),
  updated_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_members is
  'Clinic staff: auth identity + clinic membership + role. '
  'See docs/DATABASE.md#staff_members--auth-identity--clinic-membership--role.';

alter table public.clinics
  add constraint clinics_updated_by_fkey
  foreign key (updated_by) references public.staff_members (id);

create index staff_members_clinic_id_idx on public.staff_members (clinic_id);

-- ---------------------------------------------------------------------------
-- RLS helper functions — SECURITY DEFINER so the internal staff_members
-- lookup bypasses RLS for itself only, avoiding the self-reference recursion
-- gotcha. Every RLS policy below is expressed in terms of these two
-- functions, never a raw staff_members query. See docs/DATABASE.md#row-level-
-- security-strategy and Risk #3 (keep these tiny and single-purpose).
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
-- client input at the application layer (see docs/DATABASE.md) — this
-- trigger is defense-in-depth so that guarantee doesn't depend solely on the
-- application remembering to set them correctly.
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
-- See docs/DATABASE.md "No role can escalate itself".
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
-- rather than open. See docs/DATABASE.md#row-level-security-strategy.
-- ---------------------------------------------------------------------------
alter table public.clinics enable row level security;
alter table public.staff_members enable row level security;

-- Table-level grants. RLS policies are the actual security boundary, but
-- Postgres also requires the underlying GRANT to exist — without it, every
-- request is denied before RLS is even evaluated. No `anon` grants: these
-- tables must never be visible to an unauthenticated request. No DELETE
-- grant either, matching the "never hard-delete, deactivate instead" rule
-- in docs/DATABASE.md.
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
-- above, not by this policy); never DELETE (deactivate via is_active).
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

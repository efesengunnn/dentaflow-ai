-- Sprint 7: Role/Permission split. staff_members.role stays exactly what it
-- was (job function: owner | doctor | secretary | beauty_specialist) — it no
-- longer implies what a staff member can see. staff_permissions is a grant
-- table beside it, not replacing it, for capabilities that must be
-- independent of job function — a hired doctor is not automatically a
-- clinic owner. See docs/DATABASE.md#staff_permissions and Risk #2 (this is
-- the concrete case that risk predicted back in Sprint 2/3).
--
-- Also creates audit_logs — a narrow, high-value security event log (export,
-- financial-dashboard access), deliberately NOT comprehensive read-access
-- logging (that stays docs/ROADMAP.md Phase 3 scope). See
-- docs/DATABASE.md#audit_logs--narrow-high-value-security-events-sprint-7.

-- ---------------------------------------------------------------------------
-- staff_permissions
-- ---------------------------------------------------------------------------
create table public.staff_permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  staff_id uuid not null references public.staff_members (id),
  -- Deliberately text + CHECK, not a Postgres enum: a permission catalog is
  -- expected to grow (billing_access, export_access, inventory_access,
  -- report_access, user_management, ai_management, ...) and, unlike a
  -- stable clinical concept, permission keys are realistically going to be
  -- renamed/retired over a 10-year horizon — enum values are cheap to add
  -- but genuinely awkward to remove/rename. See docs/DATABASE.md.
  permission_key text not null,
  granted_by uuid references public.staff_members (id),
  granted_at timestamptz not null default now(),
  constraint staff_permissions_key_check check (permission_key in ('financial_access')),
  constraint staff_permissions_staff_key_unique unique (staff_id, permission_key)
);

comment on table public.staff_permissions is
  'Grants a capability to a staff member, independent of their role (job '
  'function). granted_by is nullable for the same bootstrap reason as '
  'staff_members.created_by — the first owner''s financial_access grant is '
  'system-issued at provisioning, not granted by another human. See '
  'docs/DATABASE.md#staff_permissions.';

create index staff_permissions_clinic_id_idx on public.staff_permissions (clinic_id);
create index staff_permissions_staff_id_idx on public.staff_permissions (staff_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
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
  'Narrow, high-value security event log — export actions and financial-'
  'dashboard views only. Deliberately not comprehensive read-access logging '
  '("who opened which patient") — that is docs/ROADMAP.md Phase 3 scope, a '
  'genuinely larger commitment (write-amplification on every read). See '
  'docs/DATABASE.md#audit_logs.';

create index audit_logs_clinic_id_created_at_idx on public.audit_logs (clinic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Owner auto-grant — every clinic's Owner is auto-granted financial_access
-- at staff_members insert time, so financial-access decisions go through
-- exactly one mechanism (current_staff_has_permission()) everywhere, never a
-- parallel `role = 'owner' OR has_permission(...)` check that could drift
-- out of sync. See docs/DATABASE.md "Owner is auto-granted financial_access".
-- ---------------------------------------------------------------------------
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

-- Backfill: the trigger above only fires on future INSERTs. Existing Owner
-- rows (Sprint 2's manually-provisioned pilot clinics) need the same grant
-- applied once, here, so financial_access is never a silent gap for an
-- account that predates this migration.
insert into public.staff_permissions (clinic_id, staff_id, permission_key, granted_by)
select clinic_id, id, 'financial_access', null
from public.staff_members
where role = 'owner'
on conflict (staff_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- current_staff_has_permission() — third RLS helper function, same
-- SECURITY DEFINER / STABLE shape as current_clinic_id()/
-- current_staff_role() (Sprint 2). See docs/DATABASE.md.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Row-Level Security. Only role = 'owner' can grant/revoke — a deliberate,
-- narrow exception to "role != permission": every permission system needs
-- one non-permission-gated bootstrap identity. The policy checks the
-- ACTING user's role, never the target row, preventing self-escalation —
-- same discipline as staff_members' own guard. audit_logs: any staff member
-- can insert a row about their own action; only owner/financial_access
-- holders can read the log itself.
-- ---------------------------------------------------------------------------
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

-- Sprint 3: Lead Management — first real business module.
-- Schema reconciliation vs. docs/DATABASE.md's original `leads` design (see
-- docs/CHANGELOG.md Sprint 3 entry for the full reasoning):
--   - status pipeline replaced: new/contacted/consultation_scheduled/
--     proposal_sent/converted/lost — stops at the Lead->Patient boundary
--     defined in docs/PRODUCT_BLUEPRINT.md Section 11 instead of encoding
--     Treatment-stage values (those belong to Patients/Treatments, Phase 2).
--   - `assigned_to` added (was explicitly deferred in DATABASE.md; reinstated
--     as an explicit founder decision for Sprint 3's Assigned Staff Filter).
--   - `notes` column dropped in favor of `lead_activities` as the single
--     source of truth for narrative history (see below).
--   - `deleted_at` added: soft delete is a distinct concept from `status =
--     'lost'` (an abandoned sales opportunity vs. a mistaken/spam record).

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
  'CRM lead pipeline entry, pre-conversion-to-patient. See docs/DATABASE.md#leads.';
comment on column public.leads.deleted_at is
  'Soft delete marker — distinct from status=''lost'' (a real dead sales '
  'opportunity vs. a mistaken/duplicate/spam entry). Never hard-deleted.';

create index leads_clinic_id_idx on public.leads (clinic_id);
create index leads_clinic_status_idx on public.leads (clinic_id, status);
create index leads_clinic_assigned_to_idx on public.leads (clinic_id, assigned_to);

-- ---------------------------------------------------------------------------
-- lead_activities — append-only activity timeline. This is the first slice
-- of the "AI Foundation" data capture called for in
-- docs/PRODUCT_BLUEPRINT.md Section 5 ("operational data captured in a form
-- AI can consume — not just current-state rows, but structured history").
-- Deliberately scoped to leads only for now (no polymorphic entity_type/
-- entity_id design) — generalizing to patients/appointments happens if and
-- when those modules actually need it, not speculatively here.
-- ---------------------------------------------------------------------------
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
  '— entries are immutable by design (editing history defeats the point of '
  'an audit/AI-memory log). created_by is nullable (unlike every other '
  'audit column in this schema) to leave room for a future system/AI-'
  'authored entry without a schema change — see docs/PRODUCT_BLUEPRINT.md '
  'Section 5 on AI writing to shared operational infrastructure. metadata '
  'carries the structured, AI-consumable payload (e.g. {"from_status": '
  '"new", "to_status": "contacted"}); description is the human-readable '
  'rendering, generated server-side at write time.';

create index lead_activities_lead_id_created_at_idx
  on public.lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit-column automation — reuses the same trigger function created in
-- Sprint 2 (public.set_audit_columns), applied to `leads` only:
-- `lead_activities` is insert-only and has no updated_by/updated_at to
-- automate.
-- ---------------------------------------------------------------------------
create trigger leads_set_audit_columns
  before insert or update on public.leads
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security — same posture as Sprint 2: enabled at creation time,
-- default-deny, every policy expressed via current_clinic_id()/
-- current_staff_role(). RBAC matches docs/DATABASE.md's existing leads row:
-- owner/secretary can write, doctor is read-only. lead_activities has no
-- UPDATE or DELETE policy at all — immutable log, enforced by default-deny,
-- not just by application convention.
-- ---------------------------------------------------------------------------
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

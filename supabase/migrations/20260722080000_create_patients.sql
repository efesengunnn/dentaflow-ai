-- Sprint 4: Patient Management + Lead->Patient conversion.
-- Schema follows the same conventions as leads/lead_activities (Sprint 3):
-- deleted_at soft delete (not is_active — DATABASE.md's original design used
-- is_active, reconciled here for consistency with leads and so shared query/
-- filter helpers work identically across both tables), assigned_to, and an
-- append-only *_activities timeline as the single source of truth for notes
-- (patients has no separate `notes` column, by explicit founder decision —
-- same reasoning as leads: one source of truth, not a column plus a feed).

create table public.patients (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  lead_id uuid unique references public.leads (id),
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  assigned_to uuid references public.staff_members (id),
  deleted_at timestamptz,
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patients is
  'Patient record. May originate from a converted lead (lead_id) or a direct '
  'entry (lead_id null). See docs/DATABASE.md#patients.';
comment on column public.patients.lead_id is
  'Set only when this patient originated from a lead conversion. UNIQUE '
  '(below) enforces "a lead converts to at most one patient" without a '
  'second FK back on leads.';

-- Clinic-scoped phone uniqueness — same rationale as the original
-- DATABASE.md design: prevents duplicate patient records within a clinic
-- (a secretary re-entering someone on a second visit) while allowing the
-- same number to exist across unrelated clinics.
create unique index patients_clinic_id_phone_key on public.patients (clinic_id, phone);

create index patients_clinic_id_idx on public.patients (clinic_id);
create index patients_clinic_assigned_to_idx on public.patients (clinic_id, assigned_to);

create trigger patients_set_audit_columns
  before insert or update on public.patients
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- patient_activities — append-only activity/notes timeline, identical shape
-- and reasoning to lead_activities (Sprint 3). A separate table rather than
-- a shared polymorphic `activities` table: the two entities' activity
-- vocabularies are genuinely different (patients have no status pipeline),
-- and unifying now would mean migrating existing lead_activities data for
-- no present need — see docs/PRODUCT_BLUEPRINT.md Open Question #5, still
-- open, revisited if a third entity needs this same shape.
-- ---------------------------------------------------------------------------
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
  'truth for patient notes (no patients.notes column exists). '
  'See docs/DATABASE.md#patient_activities.';

create index patient_activities_patient_id_created_at_idx
  on public.patient_activities (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security — same posture as leads: default-deny, owner/secretary
-- write, doctor read-only, patient_activities has no UPDATE/DELETE policy.
-- ---------------------------------------------------------------------------
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
    and public.current_staff_role() in ('owner', 'secretary')
  );

create policy patients_update_owner_or_secretary on public.patients
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  )
  with check (clinic_id = public.current_clinic_id());

create policy patient_activities_select_own_clinic on public.patient_activities
  for select
  using (clinic_id = public.current_clinic_id());

create policy patient_activities_insert_owner_or_secretary on public.patient_activities
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  );

-- ---------------------------------------------------------------------------
-- convert_lead_to_patient — the one place this sprint needs true
-- cross-table atomicity (lead status change + patient insert + two activity
-- inserts, all-or-nothing). PostgREST/supabase-js cannot express a
-- multi-table transaction across separate `.from()` calls — each is its own
-- request/transaction — so a plain Postgres function, called explicitly via
-- `supabase.rpc(...)`, is the only way to get atomicity here. This is NOT a
-- trigger: nothing calls it automatically on a table event: it only runs
-- when the application explicitly invokes it from the "Hastaya Dönüştür"
-- action. SECURITY INVOKER (not DEFINER) — every statement inside still
-- runs as the calling user, so RLS applies exactly as if the caller had run
-- these statements directly; a doctor calling this still gets rejected by
-- the same INSERT/UPDATE policies above.
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

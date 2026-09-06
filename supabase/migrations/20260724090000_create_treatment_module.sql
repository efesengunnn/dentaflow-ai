-- Sprint 7: Treatment Module — fourth real business module, supersedes the
-- never-built patient_history_entries sketch entirely. See docs/DATABASE.md
-- "Treatment Module (Sprint 7)" and docs/ARCHITECTURE.md's matching section
-- for the full design review (many rounds of deliberate re-examination
-- before this was written).
--
-- Core decision: every treatment always belongs to a series
-- (treatments.series_id is NOT NULL) — a one-off procedure gets an
-- invisible, application-created size-1 series; a real multi-session
-- package is created explicitly. This collapses what would otherwise be a
-- three-way repeated branch (fee location, payment target, AI/reporting
-- relationship chain) into one shape. See docs/DATABASE.md for the three
-- named, accepted costs of this choice.
--
-- No soft delete anywhere in this module (explicit founder requirement — a
-- real clinical/financial record is never removed from the database, not
-- even behind deleted_at). `voided` is a fourth status value instead,
-- distinct from `cancelled`: cancelled is a real outcome worth keeping
-- visible; voided means the row never represented a real event (wrong
-- patient, duplicate submission) and is excluded from the patient's active
-- clinical view and from AI/reporting queries, while the row itself is
-- never removed.

create type public.treatment_lifecycle_status as enum (
  'active',
  'completed',
  'cancelled',
  'voided'
);

-- ---------------------------------------------------------------------------
-- treatment_series — the commercial/billing unit: what was purchased, its
-- price, how many sessions. treatment_type lives here (not on treatments) —
-- a series is the classification unit, an individual session is not. Free
-- text, not an enum: see docs/DATABASE.md "treatment_type stays free text"
-- (no vertical-specific application code, per docs/PRODUCT_BLUEPRINT.md
-- Section 7).
-- ---------------------------------------------------------------------------
create table public.treatment_series (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  treatment_type text not null,
  total_sessions integer not null default 1,
  total_fee numeric(12, 2) not null,
  currency text not null default 'TRY',
  status public.treatment_lifecycle_status not null default 'active',
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_series_total_sessions_positive check (total_sessions > 0),
  constraint treatment_series_total_fee_non_negative check (total_fee >= 0)
);

comment on table public.treatment_series is
  'The commercial/billing unit for one or more treatment sessions — a real '
  'multi-session package, or an invisible size-1 series auto-created for a '
  'one-off procedure. See docs/DATABASE.md#treatment-series.';

create index treatment_series_clinic_id_idx on public.treatment_series (clinic_id);
create index treatment_series_clinic_patient_idx on public.treatment_series (clinic_id, patient_id);
create index treatment_series_clinic_status_idx on public.treatment_series (clinic_id, status);

-- ---------------------------------------------------------------------------
-- treatments — one row per session/visit. session_number is suggested by
-- the application (count of completed sessions in the series + 1), not a
-- DB-computed column — a skipped/reordered session shouldn't force a
-- cascading renumber of the rest.
-- ---------------------------------------------------------------------------
create table public.treatments (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  series_id uuid not null references public.treatment_series (id),
  staff_id uuid not null references public.staff_members (id),
  appointment_id uuid references public.appointments (id),
  session_number integer not null,
  treatment_date date not null,
  description text,
  control_date date,
  status public.treatment_lifecycle_status not null default 'active',
  created_by uuid not null references public.staff_members (id),
  updated_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatments_session_number_positive check (session_number > 0)
);

comment on table public.treatments is
  'One row per treatment session/visit. Always belongs to a treatment_series '
  '(series_id is NOT NULL, including invisible size-1 series for one-off '
  'procedures) — see docs/DATABASE.md#treatments--one-row-per-sessionvisit. '
  'appointment_id links a session to the appointment it was created from '
  '("Randevudan Tedavi Oluştur") so patient/date/provider are never '
  're-entered.';

create index treatments_clinic_id_idx on public.treatments (clinic_id);
create index treatments_series_id_idx on public.treatments (series_id);
create index treatments_patient_id_idx on public.treatments (patient_id);
create index treatments_staff_treatment_date_idx on public.treatments (staff_id, treatment_date);
create index treatments_clinic_control_date_idx on public.treatments (clinic_id, control_date);

-- ---------------------------------------------------------------------------
-- treatment_products — products used in a specific session (not the whole
-- series, sessions in the same package can use different products/
-- quantities). Not append-only, unlike the payment ledger below — no
-- financial-audit sensitivity here, editable/deletable like the parent
-- treatment row.
-- ---------------------------------------------------------------------------
create table public.treatment_products (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  treatment_id uuid not null references public.treatments (id),
  product_name text not null,
  quantity numeric not null,
  unit text,
  created_by uuid not null references public.staff_members (id),
  created_at timestamptz not null default now(),
  constraint treatment_products_quantity_positive check (quantity > 0)
);

comment on table public.treatment_products is
  'Products used during a treatment session. Free-text product_name for now '
  '— a future Inventory module adds an inventory_item_id FK here, additive, '
  'not a redesign. See docs/DATABASE.md#treatment-products--products-used-in-a-session.';

create index treatment_products_treatment_id_idx on public.treatment_products (treatment_id);

-- ---------------------------------------------------------------------------
-- treatment_payments — append-only financial ledger. Attaches to
-- treatment_series only, never to an individual treatment row — this is
-- exactly what makes a partial package payment representable (see
-- docs/DATABASE.md). "Ödenen Tutar"/"Kalan Bakiye"/"Ödeme Durumu" are never
-- stored: always SUM(amount) signed by entry_type, computed in the query
-- layer.
-- ---------------------------------------------------------------------------
create type public.treatment_payment_entry_type as enum (
  'payment',
  'refund',
  'adjustment',
  'void'
);

create type public.treatment_payment_method as enum (
  'cash',
  'credit_card',
  'bank_transfer',
  'other'
);

create table public.treatment_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  series_id uuid not null references public.treatment_series (id),
  related_payment_id uuid references public.treatment_payments (id),
  amount numeric(12, 2) not null,
  entry_type public.treatment_payment_entry_type not null default 'payment',
  method public.treatment_payment_method not null,
  currency text not null default 'TRY',
  paid_at timestamptz not null,
  recorded_by uuid not null references public.staff_members (id),
  note text,
  created_at timestamptz not null default now(),
  constraint treatment_payments_amount_positive check (amount > 0)
);

comment on table public.treatment_payments is
  'Append-only payment ledger — no UPDATE/DELETE policy at all (see below). '
  'A wrong entry gets a new refund/adjustment/void row, referencing the '
  'original via related_payment_id, never edited or removed. amount is '
  'always a positive magnitude; direction comes from entry_type, not sign. '
  'recorded_by is who entered the payment (front-desk audit) — personnel '
  'revenue attribution must join through treatments.staff_id instead, never '
  'through recorded_by (who collected the money vs. who generated the '
  'revenue are different questions). See docs/DATABASE.md#treatment-payments--append-only-financial-ledger.';

create index treatment_payments_clinic_paid_at_idx on public.treatment_payments (clinic_id, paid_at);
create index treatment_payments_series_id_idx on public.treatment_payments (series_id);
create index treatment_payments_related_payment_id_idx on public.treatment_payments (related_payment_id);

-- ---------------------------------------------------------------------------
-- treatment_activities — shared activity timeline for both series-level and
-- session-level events (exactly one of treatment_id/series_id set). A
-- deliberate exception to this schema's usual "one activity table per
-- entity" stance: a series is structurally the direct container of its
-- sessions, not an independent entity the way leads/patients/appointments
-- are — see docs/DATABASE.md.
-- ---------------------------------------------------------------------------
create type public.treatment_activity_type as enum (
  'series_created',
  'series_updated',
  'treatment_created',
  'treatment_updated',
  'status_changed',
  'payment_recorded',
  'note_added',
  'treatment_deleted'
);

create table public.treatment_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  treatment_id uuid references public.treatments (id),
  series_id uuid references public.treatment_series (id),
  activity_type public.treatment_activity_type not null,
  description text not null,
  metadata jsonb,
  created_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  constraint treatment_activities_exactly_one_parent check (
    (treatment_id is not null and series_id is null)
    or (treatment_id is null and series_id is not null)
  )
);

comment on table public.treatment_activities is
  'Append-only activity timeline shared by treatment_series (series-level '
  'events) and treatments (session-level events) — exactly one of '
  'treatment_id/series_id is set per row. See docs/DATABASE.md#treatment-activities.';

create index treatment_activities_treatment_id_created_at_idx
  on public.treatment_activities (treatment_id, created_at desc);
create index treatment_activities_series_id_created_at_idx
  on public.treatment_activities (series_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit-column automation — same trigger function as every other table in
-- this project (public.set_audit_columns, defined in Sprint 2).
-- treatment_products/treatment_payments/treatment_activities have no
-- updated_by/updated_at to automate (append-only or edit-in-place-without-
-- an-actor-trail-needed).
-- ---------------------------------------------------------------------------
create trigger treatment_series_set_audit_columns
  before insert or update on public.treatment_series
  for each row execute function public.set_audit_columns();

create trigger treatments_set_audit_columns
  before insert or update on public.treatments
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security — default-deny, same mechanism as every other table.
-- Tier-1 financial visibility (a specific series/treatment/payment's fee,
-- paid amount, balance) is deliberately readable by all roles — front-desk
-- and treating staff need it operationally. Clinic-wide financial
-- AGGREGATION is gated at the query/application layer via
-- current_staff_has_permission('financial_access'), not by restricting
-- SELECT here — see docs/DATABASE.md and docs/ARCHITECTURE.md's AI Data
-- Access section for the real, named limit of that choice.
-- ---------------------------------------------------------------------------
alter table public.treatment_series enable row level security;
alter table public.treatments enable row level security;
alter table public.treatment_products enable row level security;
alter table public.treatment_payments enable row level security;
alter table public.treatment_activities enable row level security;

grant select, insert, update on public.treatment_series to authenticated;
grant select, insert, update on public.treatments to authenticated;
grant select, insert, update, delete on public.treatment_products to authenticated;
grant select, insert on public.treatment_payments to authenticated;
grant select, insert on public.treatment_activities to authenticated;

create policy treatment_series_select_own_clinic on public.treatment_series
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_series_insert_clinical_roles on public.treatment_series
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  );

create policy treatment_series_update_clinical_roles on public.treatment_series
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

create policy treatments_select_own_clinic on public.treatments
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatments_insert_clinical_roles on public.treatments
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  );

create policy treatments_update_clinical_roles on public.treatments
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

create policy treatment_products_select_own_clinic on public.treatment_products
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_products_insert_clinical_roles on public.treatment_products
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  );

create policy treatment_products_update_clinical_roles on public.treatment_products
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  )
  with check (clinic_id = public.current_clinic_id());

create policy treatment_products_delete_clinical_roles on public.treatment_products
  for delete
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist')
  );

create policy treatment_payments_select_own_clinic on public.treatment_payments
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_payments_insert_owner_or_secretary on public.treatment_payments
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'secretary')
  );

create policy treatment_activities_select_own_clinic on public.treatment_activities
  for select
  using (clinic_id = public.current_clinic_id());

create policy treatment_activities_insert_own_clinic on public.treatment_activities
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

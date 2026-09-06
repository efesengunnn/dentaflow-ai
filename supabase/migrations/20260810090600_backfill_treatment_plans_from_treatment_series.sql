-- Sprint 28: Treatment Plan redesign (7/7) — one-time, idempotent backfill
-- of the new treatment_plans/treatment_plan_items/treatment_sessions
-- tables from the legacy treatment_series/treatments data. Legacy tables
-- are never modified by this migration — this is purely additive.
--
-- Idempotency: every insert is guarded by a NOT EXISTS check against the
-- legacy_series_id/legacy_treatment_id unique columns, so re-running this
-- migration (or re-running `supabase db reset`, which replays every
-- migration from scratch) is always a no-op on rows already backfilled.
--
-- Scope of what gets backfilled into treatment_sessions: only legacy
-- treatments rows with status in ('completed', 'voided'). Rows with
-- status in ('active', 'cancelled') represent "scheduled but not yet
-- performed" or "explicitly cancelled before happening" — states that
-- have no equivalent in the new model, where a treatment_sessions row is
-- only ever created at the moment a visit is performed. Those rows are
-- NOT lost: they remain fully intact and queryable in the legacy
-- treatments table indefinitely.
--
-- Provider attribution for the backfilled treatment_plan_items row uses
-- the same "whichever staff performed the most completed sessions in the
-- series" majority logic already used by
-- src/lib/treatments/queries.ts's resolvePrimaryStaffBySeries, reimplemented
-- here in SQL for consistency with today's reporting. provider_share_amount
-- is left null (defaults to full total_price attribution, per the new
-- table's documented convention) since no historical per-provider
-- commission/attribution data exists to backfill.
--
-- Every backfilled row also gets one treatment_activities entry
-- (metadata.migration = true) so the migration itself is visible in the
-- audit trail, not silent.

-- ---------------------------------------------------------------------------
-- 1) treatment_plans <- treatment_series (1:1)
-- ---------------------------------------------------------------------------
insert into public.treatment_plans (
  clinic_id, patient_id, plan_name, currency, status, legacy_series_id,
  created_by, updated_by, created_at, updated_at
)
select
  s.clinic_id, s.patient_id, s.treatment_type, s.currency, s.status, s.id,
  s.created_by, s.updated_by, s.created_at, s.updated_at
from public.treatment_series s
where not exists (
  select 1 from public.treatment_plans p where p.legacy_series_id = s.id
);

-- ---------------------------------------------------------------------------
-- 2) treatment_plan_items <- treatment_series (1:1 for this backfill — a
--    historical series only ever had one treatment_type/price/session
--    count). provider_id is resolved via the majority-completed-sessions
--    heuristic; a series with zero completed sessions falls back to
--    whichever staff_id appears on any session in the series, and finally
--    to the series' own created_by if it has no sessions at all.
-- ---------------------------------------------------------------------------
with primary_staff as (
  select distinct on (t.series_id)
    t.series_id,
    t.staff_id,
    count(*) filter (where t.status = 'completed') as completed_count
  from public.treatments t
  group by t.series_id, t.staff_id
  order by t.series_id, count(*) filter (where t.status = 'completed') desc, t.staff_id
)
insert into public.treatment_plan_items (
  clinic_id, patient_id, treatment_plan_id, provider_id, treatment_name,
  session_count, unit_price, total_price, status, revision_no,
  legacy_series_id, created_by, updated_by, created_at, updated_at
)
select
  s.clinic_id,
  s.patient_id,
  p.id as treatment_plan_id,
  coalesce(ps.staff_id, s.created_by) as provider_id,
  s.treatment_type,
  s.total_sessions,
  case when s.total_fee is null then null else s.total_fee / s.total_sessions end,
  s.total_fee,
  s.status,
  1,
  s.id,
  s.created_by, s.updated_by, s.created_at, s.updated_at
from public.treatment_series s
join public.treatment_plans p on p.legacy_series_id = s.id
left join primary_staff ps on ps.series_id = s.id
where not exists (
  select 1 from public.treatment_plan_items i where i.legacy_series_id = s.id
);

-- ---------------------------------------------------------------------------
-- 3) treatment_sessions <- treatments (only completed/voided)
-- ---------------------------------------------------------------------------
insert into public.treatment_sessions (
  clinic_id, patient_id, treatment_plan_item_id, appointment_id,
  session_number, performed_by, performed_at, control_date, notes,
  unit_price_snapshot, status, legacy_treatment_id, created_by, created_at,
  updated_at
)
select
  t.clinic_id,
  t.patient_id,
  i.id as treatment_plan_item_id,
  t.appointment_id,
  t.session_number,
  t.staff_id,
  t.treatment_date,
  t.control_date,
  t.description,
  i.unit_price,
  case t.status when 'completed' then 'completed'::public.treatment_session_status
                else 'voided'::public.treatment_session_status end,
  t.id,
  t.created_by, t.created_at, t.updated_at
from public.treatments t
join public.treatment_plan_items i on i.legacy_series_id = t.series_id
where t.status in ('completed', 'voided')
  and not exists (
    select 1 from public.treatment_sessions ts where ts.legacy_treatment_id = t.id
  );

-- ---------------------------------------------------------------------------
-- 4) Audit trail — one treatment_activities row per backfilled plan, so the
--    migration itself is visible in the patient timeline, not silent.
-- ---------------------------------------------------------------------------
insert into public.treatment_activities (
  clinic_id, treatment_plan_id, activity_type, description, metadata, created_by, created_at
)
select
  p.clinic_id,
  p.id,
  'series_created',
  'Tedavi planı, eski paket sisteminden otomatik olarak taşındı (Sprint 28 migration).',
  jsonb_build_object('migration', true, 'legacy_series_id', p.legacy_series_id),
  p.created_by,
  now()
from public.treatment_plans p
where p.legacy_series_id is not null
  and not exists (
    select 1 from public.treatment_activities a
    where a.treatment_plan_id = p.id
      and a.metadata ->> 'migration' = 'true'
  );

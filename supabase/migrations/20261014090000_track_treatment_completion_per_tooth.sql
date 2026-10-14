-- Founder decision 2026-10-14: session-based progress ("2 / 3 Seans
-- Tamamlandı") is replaced by tooth-based completion. Each "Tamamlandı" click
-- still inserts one treatment_sessions row (so who/when, appointment links,
-- last-visit and follow-up reads keep working unchanged), and that row now
-- records WHICH of the item's teeth it completed.
--
-- tooth_numbers semantics on treatment_sessions:
--   null  -> legacy session-based completion (pre-2026-10-14), no tooth info
--   '{}'  -> tooth-based completion of an item that has no charted teeth
--   {..}  -> tooth-based completion of exactly these teeth
--
-- Like treatment_sessions' other clinical facts, tooth_numbers is set at
-- insert and never updated by the app — undoing a completion voids the whole
-- row through the existing correction/void state machine.

alter table public.treatment_sessions
  add column tooth_numbers smallint[];

comment on column public.treatment_sessions.tooth_numbers is
  'FDI tooth numbers this completion covered. Null = legacy session-based '
  'completion, empty = completion of an item with no charted teeth. Drives '
  'treatment_plan_items.status via sync_treatment_plan_item_status().';

alter table public.treatment_sessions
  add constraint treatment_sessions_tooth_numbers_valid check (
    tooth_numbers is null
    or tooth_numbers <@ array[
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
      31, 32, 33, 34, 35, 36, 37, 38,
      41, 42, 43, 44, 45, 46, 47, 48,
      51, 52, 53, 54, 55,
      61, 62, 63, 64, 65,
      71, 72, 73, 74, 75,
      81, 82, 83, 84, 85
    ]::smallint[]
  );

-- ---------------------------------------------------------------------------
-- Status sync. An item is complete when every charted tooth is covered by a
-- live completion (or, for an item without teeth, any tooth-based completion
-- exists). Legacy session-based items keep their old meaning: complete once
-- completed sessions reach session_count. A plan is complete when none of its
-- live items is still active and at least one is completed.
--
-- Database triggers rather than app code: a secretary may complete or undo a
-- treatment (treatment_sessions INSERT/UPDATE) but RLS does not let them
-- update plan items or plans, and the status must stay correct whichever path
-- changes the underlying rows. Security definer + running inside the user's
-- own statement keeps auth.uid() set for the audit trigger.
-- Only active <-> completed is ever toggled; cancelled/voided are left alone.
-- ---------------------------------------------------------------------------

create function public.sync_treatment_plan_status(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count integer;
  v_completed_count integer;
  v_next public.treatment_lifecycle_status;
begin
  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'completed')
  into v_active_count, v_completed_count
  from public.treatment_plan_items
  where treatment_plan_id = p_plan_id
    and deleted_at is null;

  v_next := case when v_active_count = 0 and v_completed_count > 0 then 'completed' else 'active' end;

  update public.treatment_plans
  set status = v_next
  where id = p_plan_id
    and deleted_at is null
    and status in ('active', 'completed')
    and status <> v_next;
end;
$$;

create function public.sync_treatment_plan_item_status(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_teeth smallint[];
  v_completed_teeth smallint[];
  v_has_tooth_based boolean;
  v_legacy_count integer;
  v_done boolean;
  v_next public.treatment_lifecycle_status;
begin
  select id, tooth_numbers, session_count, status
  into v_item
  from public.treatment_plan_items
  where id = p_item_id
    and deleted_at is null;

  if not found or v_item.status not in ('active', 'completed') then
    return;
  end if;

  v_teeth := coalesce(v_item.tooth_numbers, '{}');

  select
    coalesce(array_agg(distinct tooth) filter (where tooth is not null), '{}'),
    coalesce(bool_or(session.tooth_numbers is not null), false),
    count(distinct session.id) filter (where session.tooth_numbers is null)
  into v_completed_teeth, v_has_tooth_based, v_legacy_count
  from public.treatment_sessions as session
  left join lateral unnest(session.tooth_numbers) as tooth on true
  where session.treatment_plan_item_id = p_item_id
    and session.status = 'completed'
    and session.deleted_at is null;

  v_done :=
    v_legacy_count >= v_item.session_count
    or (cardinality(v_teeth) = 0 and v_has_tooth_based)
    or (cardinality(v_teeth) > 0 and v_teeth <@ v_completed_teeth);

  v_next := case when v_done then 'completed' else 'active' end;

  if v_next <> v_item.status then
    update public.treatment_plan_items set status = v_next where id = p_item_id;
  end if;
end;
$$;

create function public.treatment_sessions_sync_item_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_treatment_plan_item_status(new.treatment_plan_item_id);
  return null;
end;
$$;

create trigger treatment_sessions_sync_item_status
  after insert or update of status, deleted_at, tooth_numbers on public.treatment_sessions
  for each row execute function public.treatment_sessions_sync_item_status();

create function public.treatment_plan_items_sync_statuses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tooth_numbers is distinct from old.tooth_numbers
    or new.session_count is distinct from old.session_count
  then
    perform public.sync_treatment_plan_item_status(new.id);
  end if;
  perform public.sync_treatment_plan_status(new.treatment_plan_id);
  return null;
end;
$$;

create trigger treatment_plan_items_sync_statuses
  after update of tooth_numbers, session_count, status, deleted_at on public.treatment_plan_items
  for each row execute function public.treatment_plan_items_sync_statuses();

-- Backfill: until now an item never left 'active' on its own, so legacy items
-- whose sessions are all done are still active. Audit triggers are paused
-- because auth.uid() is null in a migration and would null out updated_by.

alter table public.treatment_plan_items disable trigger treatment_plan_items_set_audit_columns;
alter table public.treatment_plans disable trigger treatment_plans_set_audit_columns;

select public.sync_treatment_plan_item_status(id)
from public.treatment_plan_items
where deleted_at is null
  and status = 'active';

alter table public.treatment_plan_items enable trigger treatment_plan_items_set_audit_columns;
alter table public.treatment_plans enable trigger treatment_plans_set_audit_columns;

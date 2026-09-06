-- Sprint 28: Treatment Plan redesign (6/7) — treatment_activities is
-- extended to also log treatment_plans/treatment_plan_items/
-- treatment_sessions events, instead of forking a parallel activities
-- table for the new module. This keeps a single unified patient timeline
-- query across legacy and new data during the transition period, rather
-- than forcing every future consumer (Patient Detail's activity feed,
-- AI's getPatientSummary) to merge two differently-shaped sources forever.
--
-- The existing exactly-one-parent CHECK (treatment_id xor series_id) is
-- replaced with num_nonnulls(...) = 1 across all five possible parent
-- columns — this scales cleanly without an unwieldy hand-written OR-chain.

alter table public.treatment_activities
  add column treatment_plan_id uuid references public.treatment_plans (id),
  add column treatment_plan_item_id uuid references public.treatment_plan_items (id),
  add column treatment_session_id uuid references public.treatment_sessions (id);

alter table public.treatment_activities
  drop constraint treatment_activities_exactly_one_parent;

alter table public.treatment_activities
  add constraint treatment_activities_exactly_one_parent check (
    num_nonnulls(treatment_id, series_id, treatment_plan_id, treatment_plan_item_id, treatment_session_id) = 1
  );

create index treatment_activities_treatment_plan_id_created_at_idx
  on public.treatment_activities (treatment_plan_id, created_at desc);
create index treatment_activities_treatment_plan_item_id_created_at_idx
  on public.treatment_activities (treatment_plan_item_id, created_at desc);
create index treatment_activities_treatment_session_id_created_at_idx
  on public.treatment_activities (treatment_session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The existing INSERT policy (treatment_activities_insert_own_clinic)
-- already allows ('owner','doctor','beauty_specialist','secretary') and
-- only checks clinic_id — it applies unchanged to rows logging the new
-- parent columns, no policy change needed here.
-- ---------------------------------------------------------------------------

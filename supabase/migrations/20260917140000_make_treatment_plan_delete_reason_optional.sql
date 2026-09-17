-- Sprint 34: soft-delete reason becomes OPTIONAL for treatment plans (founder
-- decision — the "Planı Sil" dialog should offer a reason, not force one).
-- Deleting a plan cascades the same delete metadata to its items, so both
-- tables' soft-delete constraints are relaxed: keep requiring deleted_by (so a
-- delete is still attributable), drop the mandatory delete_reason. The item
-- and session "Sil" dialogs keep asking for a reason at the UI level; this only
-- removes the DB-level requirement so a null reason is allowed.

alter table public.treatment_plans
  drop constraint treatment_plans_soft_delete_consistent;

alter table public.treatment_plans
  add constraint treatment_plans_soft_delete_consistent check (
    deleted_at is null or deleted_by is not null
  );

alter table public.treatment_plan_items
  drop constraint treatment_plan_items_soft_delete_consistent;

alter table public.treatment_plan_items
  add constraint treatment_plan_items_soft_delete_consistent check (
    deleted_at is null or deleted_by is not null
  );

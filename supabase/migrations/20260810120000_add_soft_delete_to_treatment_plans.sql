-- Sprint 28C.1: Flexible Delete & Audit. A plan can now be removed from
-- active screens without a hard DELETE — deleted_by/delete_reason are
-- mandatory whenever deleted_at is set (never a silently-hidden row).
-- Deleting a plan cascades to its treatment_plan_items (also soft-deleted,
-- see the sibling migration) but never touches appointments or
-- treatment_sessions — those stay intact and queryable, only the plan
-- itself disappears from active screens (founder decision, Sprint 28C.1).
alter table public.treatment_plans
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.staff_members (id),
  add column delete_reason text,
  add constraint treatment_plans_soft_delete_consistent check (
    deleted_at is null or (deleted_by is not null and delete_reason is not null)
  );

comment on column public.treatment_plans.deleted_at is
  'Soft delete marker — a plan is never hard-deleted. Cascades to its '
  'treatment_plan_items on delete; appointments and treatment_sessions are '
  'left untouched. See docs/DATABASE.md#treatment-plans.';

-- Sprint 28C.1: Flexible Delete & Audit — same shape as the sibling
-- treatment_plans migration. Deleting an item removes it from the plan's
-- active "kalan seans" calculation but its already-completed
-- treatment_sessions rows stay exactly as they were — a session's
-- treatment_plan_item_id keeps pointing at the (now soft-deleted) item, it
-- is never touched by this.
alter table public.treatment_plan_items
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.staff_members (id),
  add column delete_reason text,
  add constraint treatment_plan_items_soft_delete_consistent check (
    deleted_at is null or (deleted_by is not null and delete_reason is not null)
  );

comment on column public.treatment_plan_items.deleted_at is
  'Soft delete marker — an item is never hard-deleted. Its completed '
  'treatment_sessions rows remain intact and keep referencing this item. '
  'See docs/DATABASE.md#treatment-plan-items.';

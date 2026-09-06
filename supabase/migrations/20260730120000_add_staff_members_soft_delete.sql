-- Adds soft-delete to staff_members, matching the deleted_at convention
-- already used by leads/patients/appointments. Sprint 2's original design
-- deliberately blocked all deletion ("never DELETE (deactivate via
-- is_active)") because staff_members is also the actor identity behind
-- created_by/updated_by/assigned_to across every other module — a hard
-- DELETE would orphan that history. Soft delete keeps the row (and its
-- history) intact while removing the person from the active roster.
--
-- No new RLS policy is needed: this is an UPDATE (setting deleted_at), and
-- staff_update_owner_or_self already grants the owner UPDATE on any row in
-- their clinic.
alter table public.staff_members
  add column deleted_at timestamptz;

comment on column public.staff_members.deleted_at is
  'Soft delete marker — distinct from is_active (temporary, reversible '
  'login block). Setting this is permanent: the person leaves the active '
  'roster but created_by/updated_by/assigned_to references elsewhere stay '
  'intact. Never hard-deleted.';

-- Sprint 28C.1: Flexible Delete & Audit. appointments already has
-- deleted_at (20260722130000) — this adds who/why. `not valid` on the
-- consistency check: this table has real production history with rows
-- already soft-deleted (deleted_at set) from before deleted_by/delete_reason
-- existed, so a normally-validated CHECK would fail to apply against that
-- history. `not valid` enforces the rule for every write from this point
-- forward without requiring a backfill of historical rows.
alter table public.appointments
  add column deleted_by uuid references public.staff_members (id),
  add column delete_reason text,
  add constraint appointments_soft_delete_consistent check (
    deleted_at is null or (deleted_by is not null and delete_reason is not null)
  ) not valid;

comment on column public.appointments.deleted_by is
  'Who soft-deleted this appointment — mandatory (see the CHECK above) for '
  'every delete going forward; null on rows deleted before this column '
  'existed.';
comment on column public.appointments.delete_reason is
  'Why this appointment was soft-deleted — mandatory going forward. A '
  'system default is used when the deleting UI does not yet collect a '
  'reason from the user.';

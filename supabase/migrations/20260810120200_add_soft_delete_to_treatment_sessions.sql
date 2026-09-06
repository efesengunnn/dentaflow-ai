-- Sprint 28C.1: Flexible Delete & Audit. treatment_sessions keeps its
-- correction/void state machine exactly as-is (Sprint 28A) — this only adds
-- a *separate* soft-delete facility on top of it, for "this row shouldn't
-- be visible on active screens" rather than "this row's clinical facts were
-- wrong" (that's still what corrected/voided are for).
--
-- Deliberately narrow: the grant below only opens deleted_at/deleted_by/
-- delete_reason for UPDATE, extending (not replacing) the existing
-- column-level grant from 20260810090300_create_treatment_sessions.sql.
-- performed_by, performed_at, session_number and notes remain physically
-- un-updatable — soft-deleting a session can hide it, it can never rewrite
-- what happened.
alter table public.treatment_sessions
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.staff_members (id),
  add column delete_reason text,
  add constraint treatment_sessions_soft_delete_consistent check (
    deleted_at is null or (deleted_by is not null and delete_reason is not null)
  );

comment on column public.treatment_sessions.deleted_at is
  'Soft delete marker, independent of the corrected/voided state machine — '
  'see docs/DATABASE.md#treatment-sessions.';

grant update (deleted_at, deleted_by, delete_reason)
  on public.treatment_sessions to authenticated;

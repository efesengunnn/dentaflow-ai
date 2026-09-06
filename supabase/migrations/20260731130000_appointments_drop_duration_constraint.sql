-- Appointments have no duration concept (founder decision, 2026-07-31) —
-- an appointment is a single point in time. `ends_at` is only still
-- populated (always equal to starts_at) because the column is NOT NULL at
-- the DB level; the old `appointments_ends_after_starts` check
-- (ends_at > starts_at) assumed a real positive duration and now rejects
-- every insert. Relaxed to ends_at >= starts_at — trivially satisfied by
-- ends_at = starts_at, and still guards against a genuinely inverted range
-- if this table is ever touched by something other than the app itself.

alter table public.appointments
  drop constraint appointments_ends_after_starts;

alter table public.appointments
  add constraint appointments_ends_after_starts check (ends_at >= starts_at);

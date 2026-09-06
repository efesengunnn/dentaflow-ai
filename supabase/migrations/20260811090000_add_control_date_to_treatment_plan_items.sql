-- Sprint 30.3: Simplified Appointment Flow — "Kontrol Günü" (control date) is
-- captured at plan-item DEFINITION time now, not only retroactively at
-- session-completion time (treatment_sessions.control_date already covers
-- that case). This is a distinct concept: the planned follow-up date for
-- this specific patient's specific item, set by whoever sells/books the
-- package — never a fixed per-treatment-type default (founder decision,
-- 2026-08-11: "Botoks = her zaman 14 gün kontrol" is explicitly rejected;
-- it is always patient + item specific).

alter table public.treatment_plan_items
  add column control_date date;

comment on column public.treatment_plan_items.control_date is
  'Planned follow-up date for this item, set at definition time (optional). '
  'Distinct from treatment_sessions.control_date, which records the actual '
  'follow-up date after a session is completed. Feeds AI follow-up queries '
  '(upcoming/overdue control dates) — see docs/DATABASE.md.';

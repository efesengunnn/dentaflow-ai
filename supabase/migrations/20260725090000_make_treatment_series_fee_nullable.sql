-- Sprint 8: "Ücret Belirlenmedi" needs a real NULL, not a sentinel value — a
-- package can be sold over the phone before its fee is negotiated (see
-- docs/DATABASE.md's treatment_series entity notes). Isolated schema change:
-- no RLS, no permission, no new table — every existing row already has a
-- real fee value, so this is purely additive (widens what's allowed, never
-- narrows it).

alter table public.treatment_series
  alter column total_fee drop not null;

alter table public.treatment_series
  drop constraint treatment_series_total_fee_non_negative;

alter table public.treatment_series
  add constraint treatment_series_total_fee_non_negative
  check (total_fee is null or total_fee >= 0);

-- Sprint 28: Treatment Plan redesign (5/7) — treatment_payments is extended
-- to also attach to the new treatment_plans, without touching its
-- append-only ledger semantics at all: no new UPDATE/DELETE grant, the
-- related_payment_id self-FK correction pattern is unchanged, recorded_by
-- stays distinct from revenue attribution.
--
-- series_id's NOT NULL constraint is dropped so that new rows can attach
-- only to treatment_plan_id instead — every existing row keeps series_id
-- populated (never touched by this migration), new rows leave series_id
-- null and populate treatment_plan_id instead. The CHECK below enforces
-- "exactly one parent, never both, never neither" the same way
-- treatment_activities already does for treatment_id/series_id.

alter table public.treatment_payments alter column series_id drop not null;

alter table public.treatment_payments
  add column treatment_plan_id uuid references public.treatment_plans (id);

alter table public.treatment_payments
  add constraint treatment_payments_one_parent check (
    num_nonnulls(series_id, treatment_plan_id) = 1
  );

create index treatment_payments_treatment_plan_id_idx on public.treatment_payments (treatment_plan_id);

comment on column public.treatment_payments.treatment_plan_id is
  'Set for payments recorded against the new treatment_plans model '
  '(Sprint 28) instead of the legacy treatment_series. Exactly one of '
  'series_id/treatment_plan_id is set per row.';

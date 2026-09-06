-- Sprint 28A follow-up: treatment_plan_items.legacy_series_id had no
-- DB-level uniqueness guard, unlike treatment_plans.legacy_series_id and
-- treatment_sessions.legacy_treatment_id (both plain UNIQUE columns) — the
-- backfill migration's idempotency for this one table rested entirely on
-- its own NOT EXISTS check, which is safe for a single sequential run but
-- not against a concurrent double-run. A plain UNIQUE column isn't right
-- here since legacy_series_id is null for every plan item created after
-- cutover (nullable, application-created items have no legacy row) — a
-- standard UNIQUE constraint treats all those nulls as non-distinct in
-- some engines but Postgres already treats NULLs as distinct under UNIQUE,
-- so a plain UNIQUE would in fact work too; a partial unique index is used
-- anyway to make the intent explicit (uniqueness only matters for
-- migration-backfilled rows) and to avoid indexing every future null row.
--
-- Safe to apply now: no existing treatment_plan_items rows can violate
-- this (the backfill's own NOT EXISTS guard already prevented duplicates
-- in the current data), and IF NOT EXISTS makes the migration itself
-- idempotent against re-runs. The backfill migration's NOT EXISTS check
-- stays in place — this is a second, DB-enforced layer on top of it, not
-- a replacement.

create unique index if not exists treatment_plan_items_legacy_series_id_unique
  on public.treatment_plan_items (legacy_series_id)
  where legacy_series_id is not null;

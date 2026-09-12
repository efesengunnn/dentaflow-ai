-- Sprint 31 — per-item currency (TRY/EUR).
--
-- Most treatments are priced in TRY; a handful of prosthetics/veneers/crowns
-- are priced in EUR. Currency previously lived only at the plan/payment level
-- (treatment_plans.currency, treatment_payments.currency); that can't model a
-- single plan holding both a EUR and a TRY treatment (founder decision
-- 2026-09-12: mixed-currency plans are allowed). So currency moves down to the
-- catalog item and the plan item — every financial total is then computed and
-- shown per currency, never summed across currencies.

alter table public.staff_treatment_catalog_items
  add column currency text not null default 'TRY'
    check (currency in ('TRY', 'EUR'));

alter table public.treatment_plan_items
  add column currency text not null default 'TRY'
    check (currency in ('TRY', 'EUR'));

-- The founder's four EUR-priced treatments. Matched by treatment_type across
-- the clinic (catalog items are per-staff, but these treatment types are only
-- ever EUR regardless of provider). A no-op on a fresh DB where these rows were
-- never seeded — safe either way.
update public.staff_treatment_catalog_items
  set currency = 'EUR'
  where treatment_type in (
    'Hassas Tutuculu Protez - İki Çene',
    'Hassas Tutuculu Protez - Tek Çene',
    'Laminte Veneer E-Max',
    'Zirkonyum Kaplama'
  );

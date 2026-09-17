-- Sprint 33: Tooth-level treatment mapping — a treatment plan item can now
-- record which specific teeth it applies to, charted on an FDI/ISO 3950
-- odontogram in the plan wizard. Stored as a plain smallint[] on the item
-- (not a normalized junction table): the app only ever needs "which teeth"
-- for an item, always read and written together with the item itself, so an
-- array avoids an extra table/join and any N+1 on the plan detail read. A
-- junction table would only earn its keep once we need per-tooth attributes
-- (surface, per-tooth status) — deliberately out of scope now.
--
-- Optional by design: many procedures are not tooth-specific (scaling,
-- whitening, full dentures, panoramic x-ray), so null / empty array is a
-- first-class "whole-mouth or not tooth-specific" value, never forced.
--
-- FDI numbering: first digit is the quadrant (1-4 permanent, 5-8 primary/
-- deciduous), second digit the tooth position within it (1-8). The check
-- constraint below rejects any value outside the real FDI set via `<@`
-- (contained-by) against the full literal of valid numbers — a plain,
-- subquery-free expression (Postgres forbids subqueries in CHECK). It does
-- NOT enforce uniqueness within the array (that would need a subquery/
-- trigger); duplicates are prevented in the app + Zod layer instead, and a
-- duplicate would be cosmetically redundant at worst, never corrupting.

alter table public.treatment_plan_items
  add column tooth_numbers smallint[];

comment on column public.treatment_plan_items.tooth_numbers is
  'FDI/ISO 3950 tooth numbers this item applies to — permanent 11-48, '
  'primary 51-85. Null or empty means whole-mouth / not tooth-specific '
  '(optional by design, not every procedure targets specific teeth). See '
  'lib/odontogram/fdi.ts for the numbering scheme.';

alter table public.treatment_plan_items
  add constraint treatment_plan_items_tooth_numbers_valid check (
    tooth_numbers is null
    or tooth_numbers <@ array[
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
      31, 32, 33, 34, 35, 36, 37, 38,
      41, 42, 43, 44, 45, 46, 47, 48,
      51, 52, 53, 54, 55,
      61, 62, 63, 64, 65,
      71, 72, 73, 74, 75,
      81, 82, 83, 84, 85
    ]::smallint[]
  );

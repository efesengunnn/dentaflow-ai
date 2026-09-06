-- Sprint 7: add 'beauty_specialist' to staff_role — real Turkish aesthetic-
-- clinic personnel who perform treatments same as a doctor. See
-- docs/DATABASE.md#staff_members--auth-identity--clinic-membership--role.
--
-- Deliberately its own migration, run before anything that references the
-- new value (the Treatment Module's RLS policies) — ALTER TYPE ... ADD VALUE
-- must be committed in its own transaction before the new value is usable
-- elsewhere.

alter type public.staff_role add value 'beauty_specialist';

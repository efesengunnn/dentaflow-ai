-- service_role bypasses RLS (BYPASSRLS attribute) but that does not substitute for a
-- missing table-level GRANT — Postgres privilege checks run independently of RLS policy
-- evaluation. No prior migration ever granted service_role anything; the one place this
-- was needed so far (Sprint 26's staff-invite flow) was patched ad hoc directly against
-- the local dev database via `supabase db query`, never formalized into a migration — a
-- fresh database (including this project's production database) never had it. This
-- migration formalizes that fix and extends it to every current and future table/
-- function in the public schema, so the same gap can't resurface module by module.

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Sprint 7: T.C. Kimlik No (Turkish national ID) — optional, on leads and
-- patients independently. Checksum validation happens at the application
-- layer (Zod refine — the actual algorithm, not just an 11-digit regex).
-- Duplicate handling is a warning, not a block (founder's explicit
-- instruction) — deliberately NOT a unique constraint, just an index for the
-- application's pre-check query. Never selected in list queries, only in
-- detail queries and exports — an application-layer discipline, not
-- something RLS (row-level, not column-level) can enforce. See
-- docs/DATABASE.md's "T.C. Kimlik No (Sprint 7)" note under `patients`.

alter table public.leads add column tc_kimlik_no text;
alter table public.patients add column tc_kimlik_no text;

create index leads_clinic_tc_kimlik_no_idx on public.leads (clinic_id, tc_kimlik_no);
create index patients_clinic_tc_kimlik_no_idx on public.patients (clinic_id, tc_kimlik_no);

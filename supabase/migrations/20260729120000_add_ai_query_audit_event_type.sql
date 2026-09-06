-- Sprint 27 (AI Assistant Foundation, 2026-07-29): every AI panel request
-- gets its own audit_logs row (staff/clinic/role, never raw context — see
-- src/lib/ai/audit.ts), extending the same narrow event_type CHECK Sprint 7
-- introduced for 'export'/'financial_dashboard_view'. Additive only: existing
-- rows are unaffected, no backfill needed.

alter table public.audit_logs
  drop constraint audit_logs_event_type_check;

alter table public.audit_logs
  add constraint audit_logs_event_type_check
    check (event_type in ('export', 'financial_dashboard_view', 'ai_query'));

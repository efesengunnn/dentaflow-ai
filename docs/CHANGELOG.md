# Changelog — DentaFlow AI

## 2026-09-04 — Bootstrap

Repository created from ClinicFlow AI's architecture (Next.js + Supabase, auth/RBAC, design
system, module conventions), as a fresh, independent codebase and git history. Carried over:
Auth, Lead Management, Patient Management, Appointment Management (booking only, treatment
linkage removed), Staff Management, Klinik Ayarları, design system. Deliberately not carried
over: treatment/package/session model, AI features, the financial Dashboard (was built entirely
on the treatment model — currently a placeholder page). Baseline Supabase migration written
from scratch, reconciling the relevant subset of ClinicFlow AI's 35 migrations into one file.

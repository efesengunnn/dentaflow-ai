# DentaFlow AI

Modern, multi-tenant SaaS platform for dental clinics. Bootstrapped from ClinicFlow AI's
architecture (Next.js + Supabase, auth/RBAC, design system, module conventions), starting a
fresh, independent codebase and history.

> **Status:** early bootstrap (2026-09-04). The vertical-agnostic foundation — Auth (Supabase
> Auth + RBAC), Lead Management, Patient Management, Appointment Management (List/Calendar/
> Today), Staff Management, Klinik Ayarları — is in place. The dental-specific domain (tooth
> charting, procedures, treatment plans) is **not designed yet** — that is the next major piece
> of work, deliberately not carried over from ClinicFlow AI's aesthetic-clinic treatment model.

## What is DentaFlow AI?

DentaFlow AI helps dental clinics run their day-to-day operations — leads, patients,
appointments, staff — in one place. The dental treatment/procedure model (tooth-level charting,
FDI numbering, dolgu/kanal/kaplama/çekim/implant, insurance/SGK flows) is intentionally left
unbuilt for now; it needs its own domain design pass, not a mechanical adaptation of ClinicFlow
AI's aesthetic-clinic treatment plans.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth) |
| Deployment | Vercel |
| Version Control | Git / GitHub |

## Repository Structure

```
DentaFlow AI/
├── docs/            Product & technical documentation — stubs only, not yet written
├── supabase/        Supabase CLI config, migrations
├── src/             Application source code (Next.js + shadcn/ui)
└── public/          Static assets
```

## Language Policy

- **Code, identifiers, database, API, docs, git history:** English.
- **End-user interface (dashboard, forms, messages the clinic staff sees):** Turkish.

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

Supabase: create a new Supabase project (this repo does not share ClinicFlow AI's project),
copy `.env.local.example` to `.env.local` and fill in the new project's credentials, then
`npx supabase start` (local dev, requires Docker Desktop) and apply
`supabase/migrations/20260904000000_baseline_schema.sql`. After migrations are applied, regenerate
`src/lib/supabase/database.types.ts` (`npx supabase gen types typescript --local`) — the copy in
this repo right now is still ClinicFlow AI's, carried over only so the app has *a* types file
to compile against until a real Supabase project exists.

## What Was Deliberately Not Carried Over

- Treatment/package/session data model (`treatments`, `treatment_series`, `treatment_plans`,
  `treatment_plan_items`, treatment catalog) — aesthetic-clinic-specific, not applicable to
  dental.
- AI features (lead scoring, follow-up detection, AI chat panel) — parked until the dental
  domain exists for them to act on.
- Dashboard (financial/treatment summary) — was entirely built on top of the treatment model;
  currently a placeholder page.

## Contributing

Solo-founder project. Work happens on feature branches with Conventional Commits (`feat:`,
`fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

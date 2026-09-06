# src/

Application source code (Next.js App Router) for DentaFlow AI.

```
src/
├── middleware.ts                Session refresh + route protection (Sprint 2)
├── app/
│   ├── layout.tsx, page.tsx    Root layout (fonts, ThemeProvider) — "/" redirects to /dashboard
│   ├── (app)/                   Dashboard Shell route group (Sprint 1), now auth-guarded
│   │   ├── layout.tsx           AppSidebar + AppHeader, resolves the real signed-in staff member
│   │   ├── dashboard/           Overview: welcome header, module cards, activity empty-state
│   │   ├── leads/, patients/, appointments/, staff/   Placeholder pages (next CRUD sprints)
│   │   └── settings/            Nested: clinic/, users/, roles/, ai/, integrations/
│   └── (auth)/login/            Chrome-less login page (Sprint 2)
├── components/
│   ├── ui/            shadcn/ui primitives (owned, generated code — see below)
│   ├── layout/         App-level chrome: app-sidebar, app-header, nav-main, breadcrumb-nav,
│   │                   workspace-switcher, settings-nav — all driven by src/config/navigation.ts
│   ├── shared/          Reusable composed components: page-header, empty-state
│   ├── theme-provider.tsx, theme-toggle.tsx   next-themes wiring (light/dark/system)
├── config/
│   └── navigation.ts   Single source of truth for sidebar nav, settings sub-nav, and the
│                       breadcrumb resolver — see the file's own doc comments
└── lib/
    ├── utils.ts       cn() class merger
    ├── actions/auth.ts  Server Actions: login, signOut
    ├── auth/            getCurrentStaffMember() — one query for staff_members + clinics
    └── supabase/        client.ts / server.ts (typed via database.types.ts, generated from the
                         local schema), middleware.ts (session-refresh helper)
```

`components/ui/` holds shadcn/ui-generated primitives (Button, Card, Input, Dialog, Sidebar,
Breadcrumb, Avatar, Tooltip, ...). These are copied into the repo, not installed as a package,
so they're edited directly when a token or variant needs to change — see the Theming section in
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

`components/layout/` and `components/shared/` were created in Sprint 1 (Dashboard Shell) when
the first real panel was built, per the plan in [`../docs/ROADMAP.md`](../docs/ROADMAP.md) —
not stubbed out speculatively beforehand.

Full rationale: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

# Design System — DentaFlow AI

Not yet written. The component inventory currently lives in `src/components/ui` and
`src/components/shared`, carried over from ClinicFlow AI's design system as-is (generic,
vertical-agnostic components only). This document should describe tokens, interaction rules,
and the premium-visual-standard checklist referenced in `CLAUDE.md`.

## Status colours

`success` (green), `warning` (amber/yellow) and `info` (blue, added 2026-10-14) are semantic
tokens in `app/globals.css` with matching `Badge` variants. Treatment progress maps onto them:
Devam Ediyor → `warning`, Kısmen Tamamlandı → `info`, Tamamlandı → `success`
(`TREATMENT_PROGRESS_BADGE_VARIANT` in `lib/treatment-plans/constants.ts`). `info` uses a sky
hue (235) so it stays distinct from the `primary` button blue.

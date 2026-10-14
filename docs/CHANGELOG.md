# Changelog — DentaFlow AI

## 2026-09-04 — Bootstrap

Repository created from ClinicFlow AI's architecture (Next.js + Supabase, auth/RBAC, design
system, module conventions), as a fresh, independent codebase and git history. Carried over:
Auth, Lead Management, Patient Management, Appointment Management (booking only, treatment
linkage removed), Staff Management, Klinik Ayarları, design system. Deliberately not carried
over: treatment/package/session model, AI features, the financial Dashboard (was built entirely
on the treatment model — currently a placeholder page). Baseline Supabase migration written
from scratch, reconciling the relevant subset of ClinicFlow AI's 35 migrations into one file.

## 2026-09-05 — Dental Treatment Module v1

Real Supabase project linked (ref `ysvwufbnlazbjplwplhb`) and owner account bootstrapped.
Shipped the first dental-specific module: a visual FDI tooth chart (32 permanent teeth,
upper/lower arch) on the patient card, tooth-level treatment logging with a DB trigger that
keeps each tooth's condition in sync with its completed treatments, a clinic-managed treatment
catalog (Ayarlar > Tedavi Kataloğu), and private-pay balance tracking (Kalan Bakiye/Ödemeler).
Scope (founder decision): permanent dentition only, no orthodontics, no SGK/insurance — all
explicitly deferred. Found and fixed via real browser click-through: leftover "ClinicFlow AI"
branding in 4 files, and a missing "Sağlayıcı" field on the appointment form (silently dropped
when the treatment-plan picker that used to set it was removed during bootstrap).

## 2026-10-14 — Tooth-based treatment completion

Patient card: clicking a treatment plan now expands its detail inline under the plan (the side
sheet is gone there; the Dashboard drill-down still uses it). Each treatment is one row — name,
charted teeth, price, "Tamamlandı" — with a 3-colour status: yellow (Devam Ediyor), blue
(Kısmen Tamamlandı, some of several teeth done) and green (Tamamlandı). Session counters,
session history and the "Seansı Tamamla" form were removed from this flow. For multi-tooth
treatments "Tamamlandı" opens a small dialog to tick which teeth were finished; completed teeth
turn green and any completion can be undone ("Geri al"). Items and plans complete
automatically (database triggers, see DATABASE.md). The appointment detail uses the same rows,
and the booking picker now shows remaining teeth instead of remaining sessions. Design system:
new `info` colour token and Badge variant.

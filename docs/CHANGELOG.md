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

Follow-up the same day: the inline plan detail on the patient card no longer repeats Toplam/
Ödenen/Kalan and the payment list (the card's own "Ödemeler" section shows them; payment
İade/Düzeltme moved onto its rows). The session concept is gone from plan creation and editing:
the wizard's "Seans Sayısı" step (now 5 steps), the session count field in "Kalemi Düzenle",
and the session counter/history on the Tedavi Planları detail page (now progress, teeth and
completion dates). New items keep the DB default `session_count = 1`; legacy items keep theirs.
The Dashboard's plan drill-down sheet now reloads itself after any change made inside it.

## 2026-10-14 — AI assistant adapted to dental care

The AI layer now reads the treatment plan model only (the legacy package/series tables are no
longer queried). Aesthetic follow-up rules (Botoks/PRP/Mezoterapi, "30 gündür gelmeyen", "1 seans
kalan") were replaced with dental ones, single-sourced in `lib/treatment-plans/constants.ts`:
Çekim 7 days, Kanal tedavisi / İmplant / Diş taşı temizliği 6 months (a hand-entered control
date always wins), "tedavisi tamamlanmamış, randevusu olmayan" patients, and 6-month periodic
check-ups. Patients with an upcoming appointment are never flagged. The chat assistant got a
dental system prompt (FDI teeth, tooth-based progress, no diagnosis) and a
`getTreatmentPlanStatus` tool in place of `getPackageStatus`. The patient card's "AI Özet" box is
computed from the already-loaded plans via `summarizePatientTreatments` (one query fewer).

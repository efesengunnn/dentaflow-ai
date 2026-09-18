-- ===========================================================================
-- Local development seed — DentaFlow AI
-- ===========================================================================
-- Referenced by supabase/config.toml ([db.seed] sql_paths). Runs automatically
-- after migrations on `supabase db reset`.
--
-- WARNING — LOCAL ONLY. Never run this against the production/cloud database.
-- `supabase db reset --linked` would execute this seed against the linked cloud
-- project and inject the dev owner below into production. Normal deploys
-- (`supabase db push`) apply migrations only and never run seeds, so production
-- is safe as long as nobody runs a *linked* reset. The real production owner is
-- provisioned manually (see the "First owner bootstrap" note in the project
-- deployment docs), not from this file.
--
-- Why this file exists: the app has no self-signup, so after every `db reset`
-- the local database is empty and the first clinic + owner have to be created by
-- hand — and the owner's `financial_access` grant (which gates the Dashboard's
-- "Bu Ay Toplam Ciro" / "Bekleyen Bakiye" cards) was easy to miss, leaving those
-- modules silently blank. Seeding a ready-to-use owner here makes local resets
-- self-provisioning and guarantees the grant is always present.
--
-- Login after a reset:  owner@dentaflow.local  (existing local dev password;
-- the encrypted hash below is copied verbatim so the current password keeps
-- working — this is a throwaway .local dev account, never a real credential).
--
-- Every statement is idempotent (ON CONFLICT DO NOTHING), so re-running the seed
-- over an already-populated database is a no-op.
-- ===========================================================================

-- 1. Auth user + email identity (so `signInWithPassword` works locally).
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
VALUES ('00000000-0000-0000-0000-000000000000', 'ce31f13d-27b2-4504-a8c9-6096c4c6d49b', 'authenticated', 'authenticated', 'owner@dentaflow.local', '$2a$10$kfJzuJ5bLBgM6u/8J4dKYuzLoZZxWRVdw6ghit/2iF51e2BU9DeLu', now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', now(), now(), false, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'ce31f13d-27b2-4504-a8c9-6096c4c6d49b', 'ce31f13d-27b2-4504-a8c9-6096c4c6d49b', '{"sub": "ce31f13d-27b2-4504-a8c9-6096c4c6d49b", "email": "owner@dentaflow.local", "email_verified": true, "phone_verified": false}', 'email', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- 2. Clinic (tenant).
INSERT INTO public.clinics (id, name, created_at, updated_at)
VALUES ('9e556e0f-f1a4-40c4-b85b-cf19123e10a2', 'DentaFlow Test Kliniği', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 3. Owner staff member. This INSERT fires `grant_owner_financial_access`,
--    which creates the financial_access grant for a fresh owner row.
INSERT INTO public.staff_members (id, clinic_id, role, full_name, is_active, created_by, updated_by, created_at, updated_at)
VALUES ('ce31f13d-27b2-4504-a8c9-6096c4c6d49b', '9e556e0f-f1a4-40c4-b85b-cf19123e10a2', 'owner', 'Dr. Test Owner', true, 'ce31f13d-27b2-4504-a8c9-6096c4c6d49b', 'ce31f13d-27b2-4504-a8c9-6096c4c6d49b', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 4. financial_access grant — explicit backfill. The trigger in step 3 already
--    creates this for a freshly inserted owner, but running it here too
--    guarantees the grant even for an owner row that somehow predates the grant
--    (the exact "Dashboard money cards went blank" bug this seed prevents).
INSERT INTO public.staff_permissions (clinic_id, staff_id, permission_key, granted_by)
SELECT clinic_id, id, 'financial_access', NULL
FROM public.staff_members
WHERE role = 'owner'
ON CONFLICT (staff_id, permission_key) DO NOTHING;

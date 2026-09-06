-- patients_clinic_id_phone_key was a plain (non-partial) unique index, so a
-- soft-deleted patient's phone number stayed permanently reserved — deleting
-- a patient and recreating them (or anyone else) with the same phone number
-- failed with a generic "already registered" error, even though every
-- application-side duplicate/read check already correctly excludes
-- deleted_at rows (see findPatientByPhone, getPatients, etc. in
-- src/lib/patients/queries.ts). Making the index partial brings the DB
-- constraint in line with the application's own definition of "active
-- patient" — a deleted patient's phone number is immediately reusable.

drop index if exists public.patients_clinic_id_phone_key;

create unique index patients_clinic_id_phone_key
  on public.patients (clinic_id, phone)
  where deleted_at is null;

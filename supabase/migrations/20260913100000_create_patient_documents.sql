-- Sprint 33 — Patient documents (röntgen / other files). A private Storage
-- bucket plus a metadata table, both clinic-scoped by RLS. Files are uploaded
-- straight from the browser to Storage (never through a Vercel Function — its
-- 4.5MB request-body cap can't carry a panoramic X-ray), then a small metadata
-- row is inserted. Viewing is done with short-lived signed URLs, so nothing is
-- ever public. Patient medical images are sensitive data (KVKK) — private
-- bucket + RLS + signed URLs, never a public bucket.

-- ---------------------------------------------------------------------------
-- Private bucket. Path convention: {clinic_id}/{patient_id}/{uuid}-{filename}
-- so the first path segment is the tenant, which the Storage RLS checks below.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage object policies — same-clinic staff only, keyed on the first folder.
-- ---------------------------------------------------------------------------
create policy "patient_documents_objects_select_own_clinic"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
  );

create policy "patient_documents_objects_insert_own_clinic"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

create policy "patient_documents_objects_delete_own_clinic"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

-- ---------------------------------------------------------------------------
-- Metadata table — one row per uploaded file. Soft-delete via deleted_at
-- (same convention as the treatment-plan module).
-- ---------------------------------------------------------------------------
create table public.patient_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.patients (id),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.staff_members (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.patient_documents is
  'Patient file metadata (röntgen etc.); bytes live in the private '
  'patient-documents Storage bucket. See Sprint 33.';

create index patient_documents_patient_id_idx
  on public.patient_documents (patient_id)
  where deleted_at is null;

alter table public.patient_documents enable row level security;

grant select, insert, update on public.patient_documents to authenticated;

create policy patient_documents_select_own_clinic on public.patient_documents
  for select
  using (clinic_id = public.current_clinic_id());

create policy patient_documents_insert_clinical_and_front_desk on public.patient_documents
  for insert
  with check (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  );

-- Soft-delete is an UPDATE of deleted_at; same role set as insert.
create policy patient_documents_update_clinical_and_front_desk on public.patient_documents
  for update
  using (
    clinic_id = public.current_clinic_id()
    and public.current_staff_role() in ('owner', 'doctor', 'beauty_specialist', 'secretary')
  )
  with check (clinic_id = public.current_clinic_id());

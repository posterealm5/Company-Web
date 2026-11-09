-- Migration: Add Admin RLS Policies for Posters Storage Bucket
-- Created: 2026-10-24
-- Purpose: Allow authorized administrators and authenticated managers to upload, replace,
--          and delete standalone artwork in the 'posters' bucket (specifically under 'artworks/').

-- 1. Policy for INSERT (uploading files to posters bucket)
DROP POLICY IF EXISTS "Admins can upload to posters bucket" ON storage.objects;
CREATE POLICY "Admins can upload to posters bucket" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
);

-- 2. Policy for UPDATE (upsert/replacing files in posters bucket)
DROP POLICY IF EXISTS "Admins can update posters bucket" ON storage.objects;
CREATE POLICY "Admins can update posters bucket" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
)
WITH CHECK (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
);

-- 3. Policy for DELETE (removing files from posters bucket)
DROP POLICY IF EXISTS "Admins can delete from posters bucket" ON storage.objects;
CREATE POLICY "Admins can delete from posters bucket" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'posters' AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
);

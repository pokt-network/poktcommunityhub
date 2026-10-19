-- Supabase Storage bucket for proof screenshots (public-read).
-- Apply in Supabase SQL Editor, or create the bucket via Dashboard → Storage.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proofs',
  'proofs',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for proof images (uploads go through the Next.js service role).
DROP POLICY IF EXISTS "Public read proofs" ON storage.objects;
CREATE POLICY "Public read proofs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'proofs');

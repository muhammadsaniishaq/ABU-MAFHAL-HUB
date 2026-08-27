-- ==============================================================================
-- STORAGE BUCKETS & SECURITY POLICIES FOR IMAGE UPLOADS
-- ==============================================================================

-- 1. Create chat_images bucket for ticket chats & receipt attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_images', 'chat_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create kyc-documents and kyc_documents buckets for KYC verification
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc_documents', 'kyc_documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Create banners & branding buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Create cac_documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cac_documents', 'cac_documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ==============================================================================
-- RLS POLICIES FOR STORAGE OBJECTS
-- ==============================================================================

-- Allow public read access to all public buckets
DROP POLICY IF EXISTS "Public bucket objects are readable by everyone" ON storage.objects;
CREATE POLICY "Public bucket objects are readable by everyone"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('chat_images', 'kyc-documents', 'kyc_documents', 'avatars', 'banners', 'cac_documents', 'partners')
);

-- Allow authenticated users to upload files to public buckets
DROP POLICY IF EXISTS "Authenticated users can upload objects" ON storage.objects;
CREATE POLICY "Authenticated users can upload objects"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id IN ('chat_images', 'kyc-documents', 'kyc_documents', 'avatars', 'banners', 'cac_documents', 'partners')
);

-- Allow authenticated users to update their files
DROP POLICY IF EXISTS "Authenticated users can update objects" ON storage.objects;
CREATE POLICY "Authenticated users can update objects"
ON storage.objects FOR UPDATE
USING (
  auth.role() = 'authenticated' AND
  bucket_id IN ('chat_images', 'kyc-documents', 'kyc_documents', 'avatars', 'banners', 'cac_documents', 'partners')
);

-- Allow authenticated users to delete their files
DROP POLICY IF EXISTS "Authenticated users can delete objects" ON storage.objects;
CREATE POLICY "Authenticated users can delete objects"
ON storage.objects FOR DELETE
USING (
  auth.role() = 'authenticated' AND
  bucket_id IN ('chat_images', 'kyc-documents', 'kyc_documents', 'avatars', 'banners', 'cac_documents', 'partners')
);

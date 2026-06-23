-- 1. Ensure required columns exist on kyc_requests table
ALTER TABLE public.kyc_requests ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE public.kyc_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.kyc_requests ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.kyc_requests ALTER COLUMN document_url DROP NOT NULL;

-- 2. Create the kyc-documents bucket (Requires secure storage)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. (RLS is already enabled on storage.objects by default)

-- 4. Set up Storage Policies for kyc-documents bucket
-- Note: The file paths from the app are in the format "address/{user_id}/timestamp.jpeg" or "liveness/{user_id}/timestamp.jpeg"

DROP POLICY IF EXISTS "Users can upload their own KYC documents" ON storage.objects;
CREATE POLICY "Users can upload their own KYC documents" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (string_to_array(name, '/'))[2]
);

DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
CREATE POLICY "Users can view their own KYC documents" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (string_to_array(name, '/'))[2]
);

DROP POLICY IF EXISTS "Admins can view all KYC documents" ON storage.objects;
CREATE POLICY "Admins can view all KYC documents" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'kyc-documents' 
  AND public.is_admin()
);

-- 5. Add BVN column to profiles if missing (Needed for Virtual Accounts)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bvn text;

-- 6. Add kyc_tier column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_tier integer DEFAULT 0;

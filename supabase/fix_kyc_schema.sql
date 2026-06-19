-- Run this in your Supabase SQL Editor to fix the KYC Table

-- 1. Add the missing 'document_number' column (Required for BVN/NIN)
ALTER TABLE public.kyc_requests 
ADD COLUMN IF NOT EXISTS document_number text;

-- 2. Add 'notes' column (Used by Admin Panel)
ALTER TABLE public.kyc_requests 
ADD COLUMN IF NOT EXISTS notes text;

-- 3. Make 'document_url' Optional
-- (BVN/NIN submissions don't have an image, so this must be nullable)
ALTER TABLE public.kyc_requests 
ALTER COLUMN document_url DROP NOT NULL;

-- 4. Check if 'document_type' exists (It should, but safety first)
-- ALTER TABLE public.kyc_requests ADD COLUMN IF NOT EXISTS document_type text;

-- Complete SQL Script with policy cleanup to enable ENUM Dropdown in Supabase

-- Step 1: Drop the existing default on 'role' column first
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

-- Step 2: Create 'user_role' ENUM type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;
END $$;

-- Step 2.5: Drop policies blocking the column type change
DROP POLICY IF EXISTS "Admin Delete Access for cac_documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin full access for cac_pricing" ON public.cac_pricing;
DROP POLICY IF EXISTS "Admin full access for cac_requests" ON public.cac_requests;

-- Step 3: Alter column type to user_role
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE user_role 
  USING (
    CASE 
      WHEN role::text IN ('user', 'admin', 'super_admin') THEN role::user_role
      ELSE 'user'::user_role
    END
  );

-- Step 4: Set the new ENUM default value
ALTER TABLE public.profiles 
  ALTER COLUMN role SET DEFAULT 'user'::user_role;

-- SQL Migration: Convert 'role' column in public.profiles to ENUM Dropdown
-- Handles all schemas (public, storage, etc.) to safely drop policy dependencies!

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- 1. Create the user_role ENUM type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;

    -- 2. Dynamically drop ALL policies across ALL schemas (public, storage) that reference 'role' or 'profiles'
    FOR pol IN 
        SELECT policyname, tablename, schemaname 
        FROM pg_policies 
        WHERE qual LIKE '%role%' OR with_check LIKE '%role%' OR qual LIKE '%profiles%' OR with_check LIKE '%profiles%'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;

-- 3. Alter the 'role' column in public.profiles to use user_role ENUM
ALTER TABLE public.profiles 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE public.user_role USING (
    CASE 
      WHEN role::text = 'super_admin' THEN 'super_admin'::public.user_role
      WHEN role::text = 'admin' THEN 'admin'::public.user_role
      ELSE 'user'::public.user_role
    END
  ),
  ALTER COLUMN role SET DEFAULT 'user'::public.user_role;

-- 4. Re-create default policies for public and storage schemas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cac_pricing') THEN
        EXECUTE 'CREATE POLICY "Admin full access for cac_pricing" ON public.cac_pricing FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN (''admin'', ''super_admin'')))';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cac_requests') THEN
        EXECUTE 'CREATE POLICY "Admin full access for cac_requests" ON public.cac_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN (''admin'', ''super_admin'')))';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        EXECUTE 'CREATE POLICY "Admin Delete Access for cac_documents" ON storage.objects FOR DELETE USING (bucket_id = ''cac_documents'' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN (''admin'', ''super_admin'')))';
    END IF;
END $$;

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  role::text IN ('admin', 'super_admin') OR public.is_admin()
);

CREATE POLICY "Admins can update profiles" 
ON public.profiles FOR UPDATE 
USING (
  role::text IN ('admin', 'super_admin') OR public.is_admin()
);

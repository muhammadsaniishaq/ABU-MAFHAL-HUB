-- SQL Migration: Convert 'role' column in public.profiles to ENUM Dropdown
-- Dynamically drops all dependent RLS policies across all tables to avoid dependency errors!

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- 1. Create the user_role ENUM type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;

    -- 2. Dynamically find and drop ALL policies on any table that reference 'role'
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND (qual LIKE '%role%' OR with_check LIKE '%role%')
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
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

-- 4. Re-create the standard policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cac_pricing') THEN
        EXECUTE 'CREATE POLICY "Admin full access for cac_pricing" ON public.cac_pricing FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN (''admin'', ''super_admin'')))';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cac_requests') THEN
        EXECUTE 'CREATE POLICY "Admin full access for cac_requests" ON public.cac_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN (''admin'', ''super_admin'')))';
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

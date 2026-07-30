-- SQL Script: Convert 'role' column in public.profiles to ENUM 
-- Safely handles dependent RLS policies (e.g. cac_pricing)
-- This makes the Supabase Table Editor show a DROPDOWN MENU ('user', 'admin', 'super_admin') 
-- instead of requiring text typing!

-- 1. Create ENUM type for roles if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;
END $$;

-- 2. Drop policies that depend on the profiles.role column
DROP POLICY IF EXISTS "Admin full access for cac_pricing" ON public.cac_pricing;
DROP POLICY IF EXISTS "Admins can manage cac_pricing" ON public.cac_pricing;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- 3. Alter the 'role' column in public.profiles to use the ENUM type
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

-- 4. Re-create the policies cleanly
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cac_pricing') THEN
        EXECUTE 'CREATE POLICY "Admin full access for cac_pricing" ON public.cac_pricing FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN (''admin'', ''super_admin'')))';
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

-- 5. Trigger to automatically sync role changes from Table Editor to auth.users
CREATE OR REPLACE FUNCTION public.sync_user_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        UPDATE auth.users 
        SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(NEW.role::text))
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_user_role ON public.profiles;

CREATE TRIGGER trigger_sync_user_role
    AFTER UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_role_to_auth();

-- 1. Safely recreate is_admin function to avoid recursion
-- SECURITY DEFINER runs the function as the creator (superuser), bypassing RLS on public.profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up and recreate RLS policies on profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can update profiles" 
ON public.profiles FOR UPDATE 
USING (public.is_admin());

-- 3. Backfill any missing profiles for existing auth users
INSERT INTO public.profiles (id, email, full_name, role, balance, kyc_tier, created_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 
  'user', 
  0.00, 
  1,
  COALESCE(created_at, now())
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Grant explicit access on the profiles table to resolve "permission denied" errors
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

-- 5. Ensure all modern columns exist on the profiles table
DO $$ 
BEGIN 
    -- Phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone text;
    END IF;

    -- Username
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username text;
    END IF;

    -- Custom ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'custom_id') THEN
        ALTER TABLE public.profiles ADD COLUMN custom_id text;
    END IF;

    -- Address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
        ALTER TABLE public.profiles ADD COLUMN address text;
    END IF;

    -- Gender
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
        ALTER TABLE public.profiles ADD COLUMN gender text;
    END IF;

    -- Date of Birth (dob)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'dob') THEN
        ALTER TABLE public.profiles ADD COLUMN dob text;
    END IF;

    -- State
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'state') THEN
        ALTER TABLE public.profiles ADD COLUMN state text;
    END IF;

    -- Next of Kin Name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'next_of_kin_name') THEN
        ALTER TABLE public.profiles ADD COLUMN next_of_kin_name text;
    END IF;

    -- Next of Kin Phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'next_of_kin_phone') THEN
        ALTER TABLE public.profiles ADD COLUMN next_of_kin_phone text;
    END IF;

    -- Referrer ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referrer_id') THEN
        ALTER TABLE public.profiles ADD COLUMN referrer_id uuid REFERENCES public.profiles(id);
    END IF;

    -- Referral Balance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_balance') THEN
        ALTER TABLE public.profiles ADD COLUMN referral_balance decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Referral Code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code') THEN
        ALTER TABLE public.profiles ADD COLUMN referral_code text;
    END IF;

    -- Updated At
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 6. Add unique constraints safely if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_custom_id_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_custom_id_key UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referral_code_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
    END IF;
END $$;

-- 7. Enable RLS and define policies on transactions table to ensure it is secure but readable
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" 
ON public.transactions FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can manage all transactions" 
ON public.transactions FOR ALL 
USING (public.is_admin());

-- Grant explicit privileges to transactions table
GRANT ALL ON TABLE public.transactions TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transactions TO authenticated;
GRANT SELECT ON TABLE public.transactions TO anon;

-- 8. Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';




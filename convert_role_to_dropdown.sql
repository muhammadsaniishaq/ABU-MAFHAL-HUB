-- SQL Script to convert 'role' column to ENUM Dropdown in Supabase Table Editor

-- Step 1: Drop the existing default on 'role' column first
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

-- Step 2: Create 'user_role' ENUM type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;
END $$;

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

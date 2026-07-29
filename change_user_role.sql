-- SQL Script: Easily Change User Role (user, admin, super_admin) in Supabase
-- Run this in your Supabase SQL Editor.

-- ========================================================
-- OPTION 1: Change a user's role directly by Email
-- ========================================================
-- Change 'user@example.com' to the target email
-- Change 'super_admin' to 'admin', 'user', or 'super_admin'

DO $$
DECLARE
    target_email TEXT := 'admin@abumafhal.com'; -- <--- SAKA EMAIL DIN A NAN
    new_role TEXT := 'super_admin';             -- <--- SAKA ROLE ('user', 'admin', 'super_admin')
BEGIN
    -- 1. Update public.profiles
    UPDATE public.profiles 
    SET role = new_role 
    WHERE email = target_email;

    -- 2. Update auth.users metadata
    UPDATE auth.users 
    SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role))
    WHERE email = target_email;

    RAISE NOTICE 'Role successfully updated to % for %', new_role, target_email;
END $$;


-- ========================================================
-- OPTION 2: Create a reusable SQL function `set_user_role`
-- ========================================================
-- After creating this function once, you can change ANY user's role anytime 
-- by running a simple line like:
-- SELECT set_user_role('email_din_mutum@gmail.com', 'super_admin');
-- SELECT set_user_role('email_din_mutum@gmail.com', 'admin');
-- SELECT set_user_role('email_din_mutum@gmail.com', 'user');

CREATE OR REPLACE FUNCTION public.set_user_role(target_email TEXT, target_role TEXT)
RETURNS TEXT AS $$
BEGIN
    IF target_role NOT IN ('user', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Invalid role. Allowed roles: user, admin, super_admin';
    END IF;

    UPDATE public.profiles 
    SET role = target_role 
    WHERE email = target_email;

    UPDATE auth.users 
    SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(target_role))
    WHERE email = target_email;

    RETURN 'Role successfully changed to ' || target_role || ' for ' || target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================================
-- OPTION 3: View current list of users and their roles
-- ========================================================
SELECT id, email, full_name, role, status, created_at 
FROM public.profiles 
ORDER BY created_at DESC;

-- SQL Script: Create or Promote Super Admin in Supabase
-- Replace 'admin@abumafhal.com' with the actual email address

-- 1. PROMOTE AN EXISTING REGISTERED USER TO SUPER ADMIN:
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'admin@abumafhal.com';

UPDATE auth.users 
SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"super_admin"')
WHERE email = 'admin@abumafhal.com';

-- 2. VIEW ALL CURRENT ADMINS & SUPER ADMINS:
SELECT id, email, full_name, role, status, created_at 
FROM public.profiles 
WHERE role IN ('admin', 'super_admin');

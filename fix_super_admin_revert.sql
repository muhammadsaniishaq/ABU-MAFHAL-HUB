-- Promote muhammadsaniisyaku3@gmail.com to Super Admin & sync with Auth metadata

-- 1. Create automatic trigger so role changes in Table Editor NEVER revert back
CREATE OR REPLACE FUNCTION public.sync_user_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        UPDATE auth.users 
        SET raw_app_meta_data = jsonb_set(
            coalesce(raw_app_meta_data, '{}'::jsonb), 
            '{role}', 
            to_jsonb(NEW.role::text)
        )
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

-- 2. Promote muhammadsaniisyaku3@gmail.com to super_admin in BOTH tables
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'muhammadsaniisyaku3@gmail.com';

UPDATE auth.users 
SET raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), 
    '{role}', 
    '"super_admin"'
)
WHERE email = 'muhammadsaniisyaku3@gmail.com';

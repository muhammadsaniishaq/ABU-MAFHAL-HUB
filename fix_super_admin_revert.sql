-- Direct Update by User UUID: 46720c42-ab0e-47bb-98bf-7839548b715e

-- 1. Create automatic sync trigger so role changes NEVER revert back
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

-- 2. Update role to super_admin by exact User ID (UUID)
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE id = '46720c42-ab0e-47bb-98bf-7839548b715e';

UPDATE auth.users 
SET raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), 
    '{role}', 
    '"super_admin"'
)
WHERE id = '46720c42-ab0e-47bb-98bf-7839548b715e';

-- 3. Show updated result immediately in SQL Editor
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE id = '46720c42-ab0e-47bb-98bf-7839548b715e';

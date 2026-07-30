-- Direct Force Update for muhammadsaniisyaku3@gmail.com

-- 1. Attach automatic sync trigger
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

-- 2. Force Update role in profiles (Case-insensitive email match)
UPDATE public.profiles 
SET role = 'super_admin'
WHERE LOWER(TRIM(email)) LIKE '%muhammadsaniisyaku3%';

-- 3. Force Update role in auth.users
UPDATE auth.users 
SET raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), 
    '{role}', 
    '"super_admin"'
)
WHERE LOWER(TRIM(email)) LIKE '%muhammadsaniisyaku3%';

-- 4. Display result in SQL Editor so you can verify immediately!
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE LOWER(TRIM(email)) LIKE '%muhammadsaniisyaku3%';

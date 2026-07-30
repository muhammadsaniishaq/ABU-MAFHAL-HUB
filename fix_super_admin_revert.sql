-- SQL Script: Fix Role Reverting Issue & Enable Automatic Auth Metadata Sync

-- 1. Create an automatic trigger so changing role in Table Editor NEVER reverts back!
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


-- 2. Promote target user to super_admin in BOTH tables (profiles + auth.users)
-- Replace 'admin@abumafhal.com' with the actual email address you want to promote!
DO $$
DECLARE
    target_email TEXT := 'admin@abumafhal.com'; -- <--- SAKA EMAIL DIN A NAN
BEGIN
    -- Update public.profiles
    UPDATE public.profiles 
    SET role = 'super_admin' 
    WHERE email = target_email;

    -- Update auth.users metadata
    UPDATE auth.users 
    SET raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb), 
        '{role}', 
        '"super_admin"'
    )
    WHERE email = target_email;
END $$;

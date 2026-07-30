-- Definitive Fix: Disable lockdown trigger during role update & set muhammadsaniisyaku3 to super_admin

-- 1. Temporarily disable the lockdown trigger that was silently reverting NEW.role := OLD.role
ALTER TABLE public.profiles DISABLE TRIGGER tr_prevent_unauthorized_profile_updates;

-- 2. Update role to super_admin in profiles for Muhammad Sani Isyaku (46720c42-ab0e-47bb-98bf-7839548b715e)
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE id = '46720c42-ab0e-47bb-98bf-7839548b715e';

-- 3. Update role in auth.users metadata
UPDATE auth.users 
SET raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), 
    '{role}', 
    '"super_admin"'
)
WHERE id = '46720c42-ab0e-47bb-98bf-7839548b715e';

-- 4. Re-enable the lockdown trigger
ALTER TABLE public.profiles ENABLE TRIGGER tr_prevent_unauthorized_profile_updates;

-- 5. Update prevent_unauthorized_profile_updates function to allow postgres / SQL Editor role edits
CREATE OR REPLACE FUNCTION prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow service_role, postgres, or admins to modify anything
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' 
       OR current_user = 'postgres'
       OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- Revert protected columns for normal user API requests
    NEW.balance := OLD.balance;
    NEW.role := OLD.role;
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.referral_balance := OLD.referral_balance;
    NEW.monthly_profit := OLD.monthly_profit;
    NEW.reward_points := OLD.reward_points;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach automatic sync trigger so Table Editor edits stay synced
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

-- 7. Show updated result immediately
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE id = '46720c42-ab0e-47bb-98bf-7839548b715e';

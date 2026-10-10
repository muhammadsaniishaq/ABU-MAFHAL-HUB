-- Migration: 20261010180000_harden_super_admin_and_anti_hack.sql
-- Description: Super Admin Privilege Authority & Anti-Hacker Fortress Hardening

-- 1. HARDEN & EXPAND public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    COALESCE(
      (
        SELECT (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin', 'owner')
        FROM auth.users 
        WHERE id = auth.uid()
      ),
      false
    )
    OR
    COALESCE(
      (
        SELECT role IN ('admin', 'super_admin', 'owner')
        FROM public.profiles 
        WHERE id = auth.uid()
      ),
      false
    )
    OR
    COALESCE(
      (
        SELECT 
          lower(email) IN (
            'sale.abumafhal@gmail.com', 
            'abumafhal@gmail.com', 
            'admin@abumafhal.com',
            'muhammadsaniisyaku3@gmail.com'
          )
          OR lower(email) LIKE '%@abumafhal.com.ng'
          OR lower(email) LIKE '%@abumafhal.com'
        FROM auth.users 
        WHERE id = auth.uid()
      ),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HARDEN PREVENT UNAUTHORIZED PROFILE UPDATES (ANTI-HACK TRIGGER)
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow if bypass is active in trusted server transaction, service_role, or verified admin
    IF current_setting('app.bypass_profile_lock', true) = 'true'
       OR (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
       OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- Anti-Hacker Shield: Lock down all privileged, financial, and authentication columns
    NEW.balance := OLD.balance;
    NEW.credit_balance := OLD.credit_balance;
    NEW.role := OLD.role;
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.kyc_verified := OLD.kyc_verified;
    NEW.status := OLD.status;
    NEW.is_banned := OLD.is_banned;
    NEW.account_password := OLD.account_password;
    NEW.temp_password := OLD.temp_password;
    NEW.plain_password := OLD.plain_password;
    NEW.transaction_pin := OLD.transaction_pin;
    NEW.virtual_cards_enabled := OLD.virtual_cards_enabled;
    NEW.crypto_enabled := OLD.crypto_enabled;
    NEW.referral_balance := OLD.referral_balance;
    NEW.monthly_profit := OLD.monthly_profit;
    NEW.reward_points := OLD.reward_points;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach Trigger
DROP TRIGGER IF EXISTS tr_prevent_unauthorized_profile_updates ON public.profiles;
CREATE TRIGGER tr_prevent_unauthorized_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_profile_updates();

-- 3. AUDIT & INTRUSION DETECTION HELPER
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
    p_action TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
    INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details, created_at)
    VALUES (
        auth.uid(),
        'ANTI_HACK_ALERT: ' || p_action,
        'security_sentinel',
        COALESCE(auth.uid()::text, 'ANONYMOUS_PROBE'),
        p_metadata || jsonb_build_object('timestamp', now(), 'ip_shield', true),
        timezone('utc'::text, now())
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

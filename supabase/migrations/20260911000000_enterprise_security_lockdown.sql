-- Migration: 20260911000000_enterprise_security_lockdown.sql
-- Description: Enterprise Security Hardening & Zero-Vulnerability Lockdown
-- 1. Tighten public.is_admin() to eliminate domain wildcard vulnerabilities
-- 2. Harden prevent_unauthorized_profile_updates() against all privileged column tampering
-- 3. Add security logging helper

-- 1. HARDEN public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    COALESCE(
      (SELECT (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin') FROM auth.users WHERE id = auth.uid()),
      false
    )
    OR
    COALESCE(
      (SELECT role IN ('admin', 'super_admin') FROM public.profiles WHERE id = auth.uid()),
      false
    )
    OR
    COALESCE(
      (
        SELECT 
          lower(email) IN ('sale.abumafhal@gmail.com', 'abumafhal@gmail.com', 'admin@abumafhal.com')
        FROM auth.users 
        WHERE id = auth.uid()
      ),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HARDEN prevent_unauthorized_profile_updates()
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow if called within trusted transaction bypass, or by service_role, or by verified admin
    IF current_setting('app.bypass_profile_lock', true) = 'true'
       OR (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
       OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- Protect all critical and privileged columns against unauthorized direct client mutations
    NEW.balance := OLD.balance;
    NEW.role := OLD.role;
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.kyc_verified := OLD.kyc_verified;
    NEW.credit_balance := OLD.credit_balance;
    NEW.status := OLD.status;
    NEW.is_banned := OLD.is_banned;
    NEW.virtual_cards_enabled := OLD.virtual_cards_enabled;
    NEW.crypto_enabled := OLD.crypto_enabled;
    NEW.referral_balance := OLD.referral_balance;
    NEW.monthly_profit := OLD.monthly_profit;
    NEW.reward_points := OLD.reward_points;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS tr_prevent_unauthorized_profile_updates ON public.profiles;
CREATE TRIGGER tr_prevent_unauthorized_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_profile_updates();

-- 3. LOG SECURITY EVENT HELPER
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_action TEXT,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_severity TEXT DEFAULT 'warning'
) RETURNS void AS $$
BEGIN
    INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details, created_at)
    VALUES (
        COALESCE(p_user_id, auth.uid()),
        p_action,
        'security',
        COALESCE(p_user_id, auth.uid())::text,
        p_details || jsonb_build_object('severity', p_severity),
        timezone('utc'::text, now())
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. HARDEN public.deduct_balance()
CREATE OR REPLACE FUNCTION public.deduct_balance(user_id uuid, amount numeric)
RETURNS numeric AS $$
DECLARE
  current_bal numeric;
  new_bal numeric;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  -- Allow service_role, admin, or the authenticated owner themselves
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role'
     AND NOT public.is_admin()
     AND (caller_id IS NULL OR caller_id != user_id) THEN
     RAISE EXCEPTION 'Unauthorized: Cannot deduct balance from another user';
  END IF;

  IF amount <= 0 THEN
     RAISE EXCEPTION 'Invalid deduction amount';
  END IF;

  SELECT balance INTO current_bal FROM public.profiles WHERE id = user_id FOR UPDATE;

  IF current_bal IS NULL OR current_bal < amount THEN
     RAISE EXCEPTION 'Insufficient balance';
  END IF;

  new_bal := current_bal - amount;

  -- Bypass trigger for safe atomic execution
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  UPDATE public.profiles
  SET balance = new_bal
  WHERE id = user_id;

  RETURN new_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


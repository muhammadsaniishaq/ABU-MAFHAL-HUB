-- Migration: 20261115180000_admin_promotion_timelock_24h.sql
-- Description: 24-Hour Timelock and Dual Approval System for Promoting Users to Admin

-- 1. Create table admin_promotion_requests
CREATE TABLE IF NOT EXISTS public.admin_promotion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_role TEXT NOT NULL CHECK (target_role IN ('admin', 'super_admin')),
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_by_email TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    effective_after TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '24 hours'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_email TEXT,
    approved_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_by_email TEXT,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_admin_promotion_target ON public.admin_promotion_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_promotion_status ON public.admin_promotion_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_promotion_effective_after ON public.admin_promotion_requests(effective_after);

-- Enable RLS
ALTER TABLE public.admin_promotion_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view promotion requests
DROP POLICY IF EXISTS "Admins can view promotion requests" ON public.admin_promotion_requests;
CREATE POLICY "Admins can view promotion requests"
ON public.admin_promotion_requests FOR SELECT
USING (public.is_admin());

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on promotion requests" ON public.admin_promotion_requests;
CREATE POLICY "Service role full access on promotion requests"
ON public.admin_promotion_requests FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- 2. HARDEN TRIGGER ON PROFILES TO PREVENT DIRECT CLIENT PRIVILEGE ESCALATION
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow service_role or explicit trusted server transactions with bypass flag
    IF current_setting('app.bypass_profile_lock', true) = 'true'
       OR (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role') THEN
        RETURN NEW;
    END IF;

    -- If a standard admin session is updating, verify if role is being escalated to admin/super_admin
    IF public.is_admin() THEN
        -- Allow updates to normal fields, but if ROLE is being changed to admin or super_admin,
        -- it MUST go through the 24-hour promotion timelock protocol unless bypass is set!
        IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role IN ('admin', 'super_admin') THEN
            -- Revert role back to OLD.role to prevent instant escalation
            NEW.role := OLD.role;
        END IF;
        RETURN NEW;
    END IF;

    -- Anti-Hacker Shield for non-admins: Lock down all privileged, financial, and authentication columns
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

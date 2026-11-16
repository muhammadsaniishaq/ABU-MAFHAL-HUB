-- Migration: 20261116190000_super_admin_enhancements.sql
-- Description: Super Admin RPCs for Promotion Approvals, Integrity Scans, and RLS Permissions

-- 1. Ensure Admins can manage admin_promotion_requests
DROP POLICY IF EXISTS "Admins can view promotion requests" ON public.admin_promotion_requests;
DROP POLICY IF EXISTS "Admins can manage promotion requests" ON public.admin_promotion_requests;

CREATE POLICY "Admins can manage promotion requests"
ON public.admin_promotion_requests FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. SECURE RPC TO APPROVE PROMOTION (Bypasses timelock trigger safely via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.approve_admin_promotion(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_caller_id UUID;
    v_caller_email TEXT;
BEGIN
    v_caller_id := auth.uid();
    
    -- Ensure caller is admin/super_admin
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin credentials required.');
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    -- Fetch promotion request
    SELECT * INTO v_req FROM public.admin_promotion_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Promotion request not found.');
    END IF;

    IF v_req.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This promotion request is already ' || v_req.status);
    END IF;

    -- Enable session bypass for authorized Super Admin promotion
    PERFORM set_config('app.bypass_profile_lock', 'true', true);

    -- 1. Update Profile role
    UPDATE public.profiles
    SET role = v_req.target_role,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_req.target_user_id;

    -- 2. Update Auth raw_app_meta_data
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(v_req.target_role)
    )
    WHERE id = v_req.target_user_id;

    -- 3. Mark request as approved
    UPDATE public.admin_promotion_requests
    SET status = 'approved',
        approved_by = v_caller_id,
        approved_by_email = v_caller_email,
        approved_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    -- 4. Audit Log
    INSERT INTO public.audit_logs (admin_id, action, target_resource, details)
    VALUES (
        v_caller_id,
        'SUPER_ADMIN_APPROVED_PROMOTION',
        'profiles',
        jsonb_build_object(
            'request_id', p_request_id,
            'target_user_id', v_req.target_user_id,
            'promoted_to_role', v_req.target_role,
            'approved_by', v_caller_email
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'User promoted successfully to ' || v_req.target_role,
        'target_role', v_req.target_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. SECURE RPC TO REJECT/CANCEL PROMOTION
CREATE OR REPLACE FUNCTION public.reject_admin_promotion(p_request_id UUID, p_reason TEXT DEFAULT 'Rejected by Super Admin')
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_caller_id UUID;
    v_caller_email TEXT;
BEGIN
    v_caller_id := auth.uid();
    
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin credentials required.');
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    SELECT * INTO v_req FROM public.admin_promotion_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Promotion request not found.');
    END IF;

    UPDATE public.admin_promotion_requests
    SET status = 'rejected',
        cancelled_by = v_caller_id,
        cancelled_by_email = v_caller_email,
        cancelled_at = timezone('utc'::text, now()),
        notes = COALESCE(notes, '') || ' [Rejection Reason: ' || COALESCE(p_reason, 'None') || ']',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    INSERT INTO public.audit_logs (admin_id, action, target_resource, details)
    VALUES (
        v_caller_id,
        'SUPER_ADMIN_REJECTED_PROMOTION',
        'admin_promotion_requests',
        jsonb_build_object(
            'request_id', p_request_id,
            'target_user_id', v_req.target_user_id,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Promotion request has been rejected.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SYSTEM INTEGRITY SCANNER RPC
CREATE OR REPLACE FUNCTION public.run_system_integrity_scan()
RETURNS JSONB AS $$
DECLARE
    v_negative_balances INT;
    v_stuck_pending_txs INT;
    v_total_users INT;
    v_total_admins INT;
    v_total_balance NUMERIC;
    v_pending_promotions INT;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
    END IF;

    -- Count negative balances
    SELECT COUNT(*) INTO v_negative_balances FROM public.profiles WHERE balance < 0;

    -- Count transactions stuck in pending > 2 hours
    SELECT COUNT(*) INTO v_stuck_pending_txs 
    FROM public.transactions 
    WHERE status = 'pending' AND created_at < (now() - interval '2 hours');

    -- Total users & admins
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*) INTO v_total_admins FROM public.profiles WHERE role IN ('admin', 'super_admin');
    SELECT COALESCE(SUM(balance), 0) INTO v_total_balance FROM public.profiles;

    -- Pending promotions
    SELECT COUNT(*) INTO v_pending_promotions FROM public.admin_promotion_requests WHERE status = 'pending';

    RETURN jsonb_build_object(
        'success', true,
        'scanned_at', now(),
        'negative_balances', v_negative_balances,
        'stuck_pending_txs', v_stuck_pending_txs,
        'total_users', v_total_users,
        'total_admins', v_total_admins,
        'total_balance', v_total_balance,
        'pending_promotions', v_pending_promotions,
        'health_score', CASE 
            WHEN v_negative_balances = 0 AND v_stuck_pending_txs = 0 THEN 'OPTIMAL 🟢 (100%)'
            WHEN v_negative_balances > 0 THEN 'CRITICAL 🚨 (Negative Balance Detected)'
            ELSE 'ATTENTION NEEDED ⚠️ (Stuck Transactions Found)'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated
GRANT EXECUTE ON FUNCTION public.approve_admin_promotion(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_admin_promotion(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_system_integrity_scan() TO authenticated, service_role;

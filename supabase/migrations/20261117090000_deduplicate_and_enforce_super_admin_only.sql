-- Migration: 20261117090000_deduplicate_and_enforce_super_admin_only.sql
-- Description: Purge regular admin roles, enforce strict Super Admin exclusive governance, and eliminate double entries.

DO $$
DECLARE
    v_owner_emails TEXT[] := ARRAY[
        'sale.abumafhal@gmail.com', 
        'abumafhal@gmail.com', 
        'admin@abumafhal.com', 
        'muhammadsaniisyaku3@gmail.com'
    ];
BEGIN
    -- 1. Ensure all primary owner accounts are strictly set to 'super_admin'
    UPDATE public.profiles
    SET role = 'super_admin',
        updated_at = timezone('utc'::text, now())
    WHERE lower(email) = ANY(v_owner_emails);

    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        '"super_admin"'::jsonb
    )
    WHERE lower(email) = ANY(v_owner_emails);

    -- 2. Demote any user currently having role = 'admin' (non-super-admin) back to 'user'
    -- This cleans up regular admins so ONLY true 'super_admin' roles remain.
    UPDATE public.profiles
    SET role = 'user',
        updated_at = timezone('utc'::text, now())
    WHERE role = 'admin' 
      AND lower(email) != ALL(v_owner_emails);

    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        '"user"'::jsonb
    )
    WHERE (raw_app_meta_data->>'role') = 'admin'
      AND lower(email) != ALL(v_owner_emails);

    -- 3. Eliminate duplicate / redundant pending promotion requests
    -- If multiple pending requests exist for the same target_user_id, keep only the latest one
    WITH ranked_requests AS (
        SELECT id, 
               target_user_id,
               ROW_NUMBER() OVER (PARTITION BY target_user_id ORDER BY created_at DESC) as rn
        FROM public.admin_promotion_requests
        WHERE status = 'pending'
    )
    DELETE FROM public.admin_promotion_requests
    WHERE id IN (
        SELECT id FROM ranked_requests WHERE rn > 1
    );

END $$;

-- 4. SECURE RPC TO DEMOTE ANY ADMIN/USER TO REGULAR USER
CREATE OR REPLACE FUNCTION public.demote_admin_to_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_target_email TEXT;
    v_caller_id UUID;
    v_caller_email TEXT;
    v_owner_emails TEXT[] := ARRAY[
        'sale.abumafhal@gmail.com', 
        'abumafhal@gmail.com', 
        'admin@abumafhal.com', 
        'muhammadsaniisyaku3@gmail.com'
    ];
BEGIN
    v_caller_id := auth.uid();

    -- Ensure caller is authorized admin/super_admin
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin clearance required.');
    END IF;

    -- Fetch target user's email
    SELECT email INTO v_target_email FROM public.profiles WHERE id = p_user_id;
    IF v_target_email IS NULL THEN
        SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id;
    END IF;

    IF v_target_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user profile not found.');
    END IF;

    -- Protect root owner accounts from demotion
    IF lower(v_target_email) = ANY(v_owner_emails) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Action rejected: Root owner account cannot be demoted.');
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    -- Bypass profile lock for authorized admin change
    PERFORM set_config('app.bypass_profile_lock', 'true', true);

    -- Update profile role to 'user'
    UPDATE public.profiles
    SET role = 'user',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        '"user"'::jsonb
    )
    WHERE id = p_user_id;

    -- Cancel any active promotion requests for this user
    UPDATE public.admin_promotion_requests
    SET status = 'cancelled',
        cancelled_by = v_caller_id,
        cancelled_by_email = v_caller_email,
        cancelled_at = timezone('utc'::text, now()),
        notes = 'Demoted to regular user by Super Admin',
        updated_at = timezone('utc'::text, now())
    WHERE target_user_id = p_user_id AND status = 'pending';

    -- Audit log
    INSERT INTO public.audit_logs (admin_id, action, target_resource, details)
    VALUES (
        v_caller_id,
        'SUPER_ADMIN_DEMOTED_USER',
        'profiles',
        jsonb_build_object(
            'target_user_id', p_user_id,
            'target_email', v_target_email,
            'demoted_to', 'user',
            'demoted_by', v_caller_email
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'User successfully demoted to standard user.',
        'target_id', p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SECURE RPC TO APPOINT SUPER ADMIN DIRECTLY (WITH DEDUPLICATION)
CREATE OR REPLACE FUNCTION public.appoint_super_admin_direct(p_user_id UUID, p_notes TEXT DEFAULT 'Appointed by Super Admin')
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_caller_email TEXT;
    v_target_email TEXT;
    v_target_name TEXT;
BEGIN
    v_caller_id := auth.uid();

    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin clearance required.');
    END IF;

    SELECT email, full_name INTO v_target_email, v_target_name FROM public.profiles WHERE id = p_user_id;
    IF v_target_email IS NULL THEN
        SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id;
    END IF;

    IF v_target_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user profile not found.');
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    -- Enable session bypass
    PERFORM set_config('app.bypass_profile_lock', 'true', true);

    -- 1. Upgrade profile role to 'super_admin'
    UPDATE public.profiles
    SET role = 'super_admin',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    -- 2. Upgrade auth.users metadata
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        '"super_admin"'::jsonb
    )
    WHERE id = p_user_id;

    -- 3. Resolve any pending promotion requests for this user to avoid double requests
    UPDATE public.admin_promotion_requests
    SET status = 'approved',
        approved_by = v_caller_id,
        approved_by_email = v_caller_email,
        approved_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE target_user_id = p_user_id AND status = 'pending';

    -- 4. Audit Log
    INSERT INTO public.audit_logs (admin_id, action, target_resource, details)
    VALUES (
        v_caller_id,
        'SUPER_ADMIN_APPOINTED',
        'profiles',
        jsonb_build_object(
            'target_user_id', p_user_id,
            'target_email', v_target_email,
            'promoted_to_role', 'super_admin',
            'appointed_by', v_caller_email,
            'notes', p_notes
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'User ' || COALESCE(v_target_name, v_target_email) || ' appointed as SUPER ADMIN successfully.',
        'target_role', 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.demote_admin_to_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appoint_super_admin_direct(UUID, TEXT) TO authenticated, service_role;

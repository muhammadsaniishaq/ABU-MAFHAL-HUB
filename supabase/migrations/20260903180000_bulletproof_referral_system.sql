-- Migration: Bulletproof Referral System & RPC
-- Ensures referrals count across email signup, OTP verification, and Google OAuth

-- 1. Backfill referral_code on any existing profiles where it is missing
UPDATE public.profiles
SET referral_code = UPPER(COALESCE(NULLIF(TRIM(referral_code), ''), NULLIF(TRIM(username), ''), SUBSTRING(id::text FROM 1 FOR 8)))
WHERE referral_code IS NULL OR TRIM(referral_code) = '';

-- 2. Create public.record_referral RPC function (callable from client, triggers, or backend)
CREATE OR REPLACE FUNCTION public.record_referral(referee_user_id UUID, referral_input TEXT)
RETURNS JSONB AS $$
DECLARE
    clean_code TEXT;
    clean_phone TEXT;
    referrer_uid UUID;
    reward_val DECIMAL(12,2) := 0.00;
    is_enabled BOOLEAN := true;
    setting_row RECORD;
    existing_ref RECORD;
    new_username TEXT;
BEGIN
    -- Validate inputs
    IF referee_user_id IS NULL OR referral_input IS NULL OR TRIM(referral_input) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Empty referee ID or referral code');
    END IF;

    -- Clean the referral code input (strip leading @, spaces, lowercase)
    clean_code := LOWER(TRIM(REGEXP_REPLACE(referral_input, '^@+', '')));
    clean_phone := REGEXP_REPLACE(clean_code, '[^0-9]', '', 'g');

    -- Look up referrer in public.profiles (case-insensitive across username, referral_code, custom_id, phone, email, and id prefix)
    SELECT id, username INTO referrer_uid, new_username
    FROM public.profiles
    WHERE id <> referee_user_id -- Cannot refer oneself!
      AND (
          LOWER(TRIM(username)) = clean_code
          OR LOWER(TRIM(COALESCE(referral_code, ''))) = clean_code
          OR LOWER(TRIM(COALESCE(custom_id, ''))) = clean_code
          OR LOWER(TRIM(COALESCE(email, ''))) = clean_code
          OR (clean_phone <> '' AND (
              REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = clean_phone
              OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || clean_phone
          ))
          OR id::text ILIKE clean_code || '%'
      )
    LIMIT 1;

    IF referrer_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referrer not found for code: ' || referral_input);
    END IF;

    -- Check if this referee is already recorded
    SELECT * INTO existing_ref FROM public.referrals WHERE referee_id = referee_user_id LIMIT 1;
    IF existing_ref.id IS NOT NULL THEN
        -- If already linked, return existing record
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Referral already recorded previously',
            'referrer_id', existing_ref.referrer_id,
            'reward_amount', existing_ref.reward_amount
        );
    END IF;

    -- Check if system is enabled
    SELECT 
        COALESCE((value->>'enabled')::boolean, (value::text)::boolean, true) INTO is_enabled
    FROM public.app_settings 
    WHERE key = 'referral_enabled' 
    LIMIT 1;

    IF is_enabled IS NULL THEN
        is_enabled := true;
    END IF;

    -- Determine reward amount (checking both 'referral_reward' object/number and 'referral_bonus')
    FOR setting_row IN 
        SELECT key, value FROM public.app_settings 
        WHERE key IN ('referral_reward', 'referral_bonus')
    LOOP
        IF setting_row.key = 'referral_reward' THEN
            IF jsonb_typeof(setting_row.value) = 'object' AND setting_row.value->>'amount' IS NOT NULL THEN
                reward_val := (setting_row.value->>'amount')::decimal;
            ELSIF jsonb_typeof(setting_row.value) = 'number' THEN
                reward_val := (setting_row.value::text)::decimal;
            END IF;
        ELSIF setting_row.key = 'referral_bonus' AND (reward_val IS NULL OR reward_val = 0.00) THEN
            IF setting_row.value IS NOT NULL AND jsonb_typeof(setting_row.value) = 'string' THEN
                reward_val := NULLIF(REGEXP_REPLACE(setting_row.value::text, '[^0-9.]', '', 'g'), '')::decimal;
            ELSIF setting_row.value IS NOT NULL AND jsonb_typeof(setting_row.value) = 'number' THEN
                reward_val := (setting_row.value::text)::decimal;
            END IF;
        END IF;
    END LOOP;

    IF reward_val IS NULL THEN
        reward_val := 0.00;
    END IF;

    -- 1. Insert into public.referrals
    INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
    VALUES (referrer_uid, referee_user_id, 'paid', reward_val)
    ON CONFLICT (referee_id) DO UPDATE SET
        referrer_id = EXCLUDED.referrer_id,
        reward_amount = EXCLUDED.reward_amount,
        status = 'paid';

    -- 2. Link referrer_id on referee's profile
    UPDATE public.profiles
    SET referrer_id = referrer_uid
    WHERE id = referee_user_id AND (referrer_id IS NULL OR referrer_id <> referrer_uid);

    -- 3. Credit referrer balance if reward > 0
    IF reward_val > 0 THEN
        UPDATE public.profiles
        SET referral_balance = COALESCE(referral_balance, 0) + reward_val
        WHERE id = referrer_uid;
    END IF;

    -- 4. Send notification to referrer
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
        referrer_uid,
        'Sabon Referral Ya Yi Rajista! 🎉',
        CASE 
            WHEN reward_val > 0 THEN 'Wani sabon mai amfani ya yi rajista da lambar gayyatarka! Ka sami kyautar ₦' || reward_val::text || ' kai-tsaye zuwa referral balance.'
            ELSE 'Wani sabon mai amfani ya yi rajista da lambar gayyatarka (Referral Code).'
        END,
        jsonb_build_object('type', 'referral', 'referee_id', referee_user_id, 'reward', reward_val)
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Referral recorded successfully',
        'referrer_id', referrer_uid,
        'reward_amount', reward_val
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.record_referral(UUID, TEXT) TO authenticated, anon, service_role;

-- 3. Update public.handle_new_user() trigger to use record_referral
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    ref_code TEXT;
    new_username TEXT;
    new_phone TEXT;
    new_email TEXT;
BEGIN
    BEGIN
        new_email := LOWER(TRIM(COALESCE(new.email, '')));
        new_username := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new_email, '@', 1))));
        new_phone := TRIM(COALESCE(new.raw_user_meta_data->>'phone', ''));

        -- Ensure fallback username if empty
        IF new_username = '' THEN
            new_username := 'user_' || SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 6);
        END IF;

        -- Extract referral code from metadata
        ref_code := TRIM(COALESCE(
            new.raw_user_meta_data->>'referral_code', 
            new.raw_user_meta_data->>'ref', 
            new.raw_user_meta_data->>'code',
            ''
        ));

        -- Insert Profile with role = 'user' ALWAYS
        INSERT INTO public.profiles (
            id, 
            email, 
            full_name, 
            role, 
            username, 
            custom_id, 
            phone,
            referral_code
        )
        VALUES (
            new.id, 
            new.email, 
            COALESCE(new.raw_user_meta_data->>'full_name', 'User'), 
            'user',
            new_username,
            COALESCE(new.raw_user_meta_data->>'custom_id', 'AM-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 6))),
            NULLIF(new_phone, ''),
            UPPER(COALESCE(new_username, SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8)))
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            username = COALESCE(public.profiles.username, EXCLUDED.username),
            phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

        -- If referral code provided, record the referral
        IF ref_code <> '' THEN
            PERFORM public.record_referral(new.id, ref_code);
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'handle_new_user exception handled: %', SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix Referral Commission to respect 0 (zero) setting from Admin app_settings
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    ref_code TEXT;
    referrer_uid UUID;
    reward_val DECIMAL(12,2);
    is_enabled BOOLEAN;
BEGIN
    -- 1. Extract referral code from metadata (passed during signup)
    ref_code := new.raw_user_meta_data->>'referral_code';
    
    -- Find referrer by username, referral_code, custom_id (case-insensitive)
    IF ref_code IS NOT NULL AND ref_code <> '' THEN
        BEGIN
            SELECT id INTO referrer_uid FROM public.profiles 
            WHERE LOWER(username) = LOWER(TRIM(ref_code))
               OR LOWER(referral_code) = LOWER(TRIM(ref_code)) 
               OR LOWER(custom_id) = LOWER(TRIM(ref_code))
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            referrer_uid := NULL;
        END;
    END IF;

    -- 2. Insert Profile (Primary Action - MUST ALWAYS SUCCEED)
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        role, 
        username, 
        custom_id, 
        phone,
        referrer_id,
        referral_code
    )
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'User'), 
        'user',
        COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'custom_id', 'AM-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 6))),
        new.raw_user_meta_data->>'phone',
        referrer_uid,
        COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1))
    )
    ON CONFLICT (id) DO UPDATE SET
        referrer_id = COALESCE(public.profiles.referrer_id, EXCLUDED.referrer_id);

    -- 3. Referral Reward Processing
    BEGIN
        -- Check if Referral System is Enabled
        SELECT COALESCE((value->>'enabled')::boolean, true) INTO is_enabled
        FROM public.app_settings WHERE key = 'referral_enabled';

        IF referrer_uid IS NOT NULL AND (is_enabled IS NULL OR is_enabled = true) THEN
            -- Fetch reward from app_settings (supports both JSON object {"amount": 500} and scalar numbers)
            SELECT 
                CASE 
                    WHEN jsonb_typeof(value) = 'object' AND value->>'amount' IS NOT NULL THEN (value->>'amount')::decimal
                    WHEN jsonb_typeof(value) = 'number' THEN (value::text)::decimal
                    ELSE 0.00
                END INTO reward_val
            FROM public.app_settings WHERE key = 'referral_reward';
            
            -- Fallback ONLY if setting key is missing (NULL)
            IF reward_val IS NULL THEN 
                reward_val := 0.00; 
            END IF;

            -- Log referral transaction record so referee ALWAYS appears in referrer's referral count and list
            INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
            VALUES (referrer_uid, new.id, 'paid', reward_val)
            ON CONFLICT (referee_id) DO UPDATE SET
                reward_amount = EXCLUDED.reward_amount,
                status = 'paid';

            -- Only credit referrer's referral_balance if reward_val > 0
            IF reward_val > 0 THEN
                UPDATE public.profiles 
                SET referral_balance = COALESCE(referral_balance, 0) + reward_val
                WHERE id = referrer_uid;

                -- Send automated notification to referrer
                INSERT INTO public.notifications (user_id, title, body, data)
                VALUES (
                    referrer_uid, 
                    'Referral Bonus Received! 🎉', 
                    'You earned ₦' || reward_val || ' because a new user registered using your referral link!',
                    jsonb_build_object('type', 'referral', 'referee_id', new.id)
                );
            ELSE
                -- Notification for registration when zero bonus is set
                INSERT INTO public.notifications (user_id, title, body, data)
                VALUES (
                    referrer_uid, 
                    'New Referral Registered! 🎉', 
                    'A new user registered using your referral code!',
                    jsonb_build_object('type', 'referral', 'referee_id', new.id)
                );
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Referral processing notice: %', SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

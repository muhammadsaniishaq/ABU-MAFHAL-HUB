-- Migration: Fix handle_new_user trigger and eliminate database error & auto-admin elevation

-- 1. Ensure public.handle_new_user() ALWAYS sets role = 'user' and handles notifications schema cleanly
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    ref_code TEXT;
    referrer_uid UUID;
    reward_val DECIMAL(12,2);
    is_enabled BOOLEAN;
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
        ref_code := new.raw_user_meta_data->>'referral_code';
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

        -- Insert Profile with role = 'user' ALWAYS
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
            new_username,
            COALESCE(new.raw_user_meta_data->>'custom_id', 'AM-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 6))),
            NULLIF(new_phone, ''),
            referrer_uid,
            UPPER(COALESCE(new_username, SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8)))
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            username = COALESCE(public.profiles.username, EXCLUDED.username),
            phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
            referrer_id = COALESCE(public.profiles.referrer_id, EXCLUDED.referrer_id);

        -- Referral Reward Payout Logic (Wrapped safely in exception handler)
        IF referrer_uid IS NOT NULL THEN
            BEGIN
                SELECT COALESCE((value->>'enabled')::boolean, true) INTO is_enabled
                FROM public.app_settings WHERE key = 'referral_enabled';

                IF is_enabled IS NULL OR is_enabled = true THEN
                    SELECT 
                        CASE 
                            WHEN jsonb_typeof(value) = 'object' AND value->>'amount' IS NOT NULL THEN (value->>'amount')::decimal
                            WHEN jsonb_typeof(value) = 'number' THEN (value::text)::decimal
                            ELSE 0.00
                        END INTO reward_val
                    FROM public.app_settings WHERE key = 'referral_reward';
                    
                    IF reward_val IS NULL THEN 
                        reward_val := 0.00; 
                    END IF;

                    INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
                    VALUES (referrer_uid, new.id, 'paid', reward_val)
                    ON CONFLICT (referee_id) DO UPDATE SET
                        reward_amount = EXCLUDED.reward_amount,
                        status = EXCLUDED.status;

                    INSERT INTO public.notifications (user_id, title, body, data)
                    VALUES (
                        referrer_uid, 
                        'New Referral Registered! 🎉', 
                        'User ' || COALESCE(new.raw_user_meta_data->>'full_name', new_username) || ' registered with your referral code! Bonus: ₦' || reward_val, 
                        jsonb_build_object('type', 'referral', 'referee_id', new.id)
                    );

                    IF reward_val > 0 THEN
                        UPDATE public.profiles 
                        SET referral_balance = COALESCE(referral_balance, 0) + reward_val
                        WHERE id = referrer_uid;
                    END IF;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Referral reward trigger notice: %', SQLERRM;
            END;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'handle_new_user exception handled: %', SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Downgrade any non-admin profiles that were falsely marked as admin
UPDATE public.profiles 
SET role = 'user' 
WHERE role = 'admin' 
  AND LOWER(email) NOT IN ('sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com');

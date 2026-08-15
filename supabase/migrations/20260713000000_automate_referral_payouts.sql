-- Automated & Dynamic Referral Payout Function & Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    ref_code TEXT;
    referrer_uid UUID;
    reward_val DECIMAL(12,2);
    is_enabled BOOLEAN;
BEGIN
    -- Check if Referral System is Enabled
    SELECT COALESCE((value->>'enabled')::boolean, true) INTO is_enabled
    FROM public.app_settings WHERE key = 'referral_enabled';

    -- Extract referral code from metadata (passed during signup)
    ref_code := new.raw_user_meta_data->>'referral_code';
    
    -- Find referrer by username, referral_code, custom_id (case-insensitive)
    IF ref_code IS NOT NULL AND ref_code <> '' THEN
        SELECT id INTO referrer_uid FROM public.profiles 
        WHERE LOWER(username) = LOWER(TRIM(ref_code))
           OR LOWER(referral_code) = LOWER(TRIM(ref_code)) 
           OR LOWER(custom_id) = LOWER(TRIM(ref_code))
        LIMIT 1;
    END IF;

    -- Insert Profile with Referrer (if found)
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
        referrer_id = EXCLUDED.referrer_id;
    
    -- If Referrer Exists AND System is Enabled, Process Reward
    IF referrer_uid IS NOT NULL AND (is_enabled IS NULL OR is_enabled = true) THEN
        -- Fetch reward from settings (supports both JSON object {"amount": 500} and scalar numbers)
        SELECT 
            CASE 
                WHEN jsonb_typeof(value) = 'object' AND value->>'amount' IS NOT NULL THEN (value->>'amount')::decimal
                WHEN jsonb_typeof(value) = 'number' THEN (value::text)::decimal
                ELSE 500.00
            END INTO reward_val
        FROM public.app_settings WHERE key = 'referral_reward';
        
        -- Fallback default reward if not configured
        IF reward_val IS NULL OR reward_val <= 0 THEN 
            reward_val := 500.00; 
        END IF;

        -- 1. Log referral transaction record
        INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
        VALUES (referrer_uid, new.id, 'paid', reward_val)
        ON CONFLICT (referee_id) DO UPDATE SET
            reward_amount = EXCLUDED.reward_amount,
            status = 'paid';

        -- 2. Instantly credit referrer's referral_balance!
        UPDATE public.profiles 
        SET referral_balance = COALESCE(referral_balance, 0) + reward_val
        WHERE id = referrer_uid;

        -- 3. Send automated notification to referrer
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            referrer_uid, 
            'Referral Bonus Received! 🎉', 
            'You earned ₦' || reward_val || ' because a new user registered using your referral link!',
            'referral'
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

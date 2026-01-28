-- 1. Seed New Settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('referral_enabled', '{"enabled": true}', 'Master toggle for the referral system'),
    ('min_withdrawal', '{"amount": 1000.00}', 'Minimum amount required to withdraw referral earnings')
ON CONFLICT (key) DO NOTHING;

-- 2. Update Trigger to Respect 'referral_enabled'
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
    
    -- Find referrer by username (which we use as referral code)
    IF ref_code IS NOT NULL AND ref_code <> '' THEN
        SELECT id INTO referrer_uid FROM public.profiles WHERE username = ref_code;
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
        new.raw_user_meta_data->>'full_name', 
        'user',
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'custom_id',
        new.raw_user_meta_data->>'phone',
        referrer_uid,
        new.raw_user_meta_data->>'username'
    );
    
    -- If Referrer Exists AND System is Enabled, Reward
    IF referrer_uid IS NOT NULL AND is_enabled THEN
        -- Fetch reward from settings or default to 4.00
        SELECT COALESCE((value->>'amount')::decimal, 4.00) INTO reward_val 
        FROM public.app_settings WHERE key = 'referral_reward';
        
        -- Fallback
        IF reward_val IS NULL THEN reward_val := 4.00; END IF;

        INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
        VALUES (referrer_uid, new.id, 'pending', reward_val);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

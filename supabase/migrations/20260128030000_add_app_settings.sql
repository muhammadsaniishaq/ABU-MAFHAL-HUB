-- 1. Create App Settings Table for Dynamic Config
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only Admins can manage settings
CREATE POLICY "Admins can manage app settings" 
ON public.app_settings FOR ALL 
USING (public.is_admin());

-- Authenticated users can read settings (needed for UI to fetch URL)
CREATE POLICY "Users can read app settings" 
ON public.app_settings FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. Seed Default Values
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('referral_reward', '{"amount": 4.00, "currency": "NGN"}', 'Reward amount for referring a new user'),
    ('referral_url', '{"url": "https://abumafhal.com.ng"}', 'Base URL for referral links')
ON CONFLICT (key) DO NOTHING;

-- 4. Update User Creation Trigger to use Dynamic Settings
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    ref_code TEXT;
    referrer_uid UUID;
    reward_val DECIMAL(12,2);
BEGIN
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
    
    -- If a Valid Referrer Exists, Create Referral Record with Dynamic Reward
    IF referrer_uid IS NOT NULL THEN
        -- Fetch reward from settings or default to 4.00
        SELECT COALESCE((value->>'amount')::decimal, 4.00) INTO reward_val 
        FROM public.app_settings WHERE key = 'referral_reward';
        
        -- Fallback if null (though seed ensures it exists)
        IF reward_val IS NULL THEN reward_val := 4.00; END IF;

        INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
        VALUES (referrer_uid, new.id, 'pending', reward_val);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

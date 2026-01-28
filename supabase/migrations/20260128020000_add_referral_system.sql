-- 1. Add Referral Columns to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS referral_balance DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Create Referrals Table (Transaction Log for Referrals)
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) NOT NULL,
    referee_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid'
    reward_amount DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(referee_id) -- A user can only be referred once
);

-- 3. Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrer can see their referrals
DROP POLICY IF EXISTS "Users can view their referrals" ON public.referrals;
CREATE POLICY "Users can view their referrals" 
ON public.referrals FOR SELECT 
USING (auth.uid() = referrer_id);

-- Admins can view all
DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
CREATE POLICY "Admins can view all referrals" 
ON public.referrals FOR ALL 
USING (public.is_admin());

-- 4. Update User Creation Trigger to Handle Referrals
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    ref_code TEXT;
    referrer_uid UUID;
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
        referrer_id, -- New Link
        referral_code -- Set their own code (username)
    )
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        'user',
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'custom_id',
        new.raw_user_meta_data->>'phone',
        referrer_uid, -- Link ID
        new.raw_user_meta_data->>'username' -- Use username as their referral code
    );
    
    -- If a Valid Referrer Exists, Create Referral Record
    IF referrer_uid IS NOT NULL THEN
        INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
        VALUES (referrer_uid, new.id, 'pending', 4.00); -- Default NGN 4 Reward
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

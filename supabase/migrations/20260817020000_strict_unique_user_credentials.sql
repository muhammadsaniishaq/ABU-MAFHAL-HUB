-- Migration: Strict Unique Constraints for Email, Username, and Phone Number
-- Enforces that no two users can share the same email, username, or phone number in public.profiles.

-- 1. Ensure columns exist on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Create UNIQUE Indexes for Case-Insensitive Email and Username, and Unique Phone Number
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles (LOWER(TRIM(email)));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (LOWER(TRIM(username))) WHERE username IS NOT NULL AND username <> '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx ON public.profiles (TRIM(phone)) WHERE phone IS NOT NULL AND phone <> '';

-- 3. Update public.handle_new_user() to validate uniqueness before inserting into profiles
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
    new_email := LOWER(TRIM(new.email));
    new_username := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1))));
    new_phone := TRIM(COALESCE(new.raw_user_meta_data->>'phone', ''));

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = new_email AND id <> new.id) THEN
        RAISE EXCEPTION 'Account with this email already exists.';
    END IF;

    -- Check if username already exists
    IF new_username <> '' AND EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = new_username AND id <> new.id) THEN
        RAISE EXCEPTION 'Username already taken. Please choose another username.';
    END IF;

    -- Check if phone number already exists
    IF new_phone <> '' AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE phone IS NOT NULL 
          AND phone <> '' 
          AND (phone = new_phone OR RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(new_phone, '\D', '', 'g'), 10))
          AND id <> new.id
    ) THEN
        RAISE EXCEPTION 'Account with this phone number already exists.';
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

    -- Insert Profile
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
        username = EXCLUDED.username,
        phone = EXCLUDED.phone,
        referrer_id = COALESCE(public.profiles.referrer_id, EXCLUDED.referrer_id);

    -- Referral Reward Payout Logic
    BEGIN
        SELECT COALESCE((value->>'enabled')::boolean, true) INTO is_enabled
        FROM public.app_settings WHERE key = 'referral_enabled';

        IF referrer_uid IS NOT NULL AND (is_enabled IS NULL OR is_enabled = true) THEN
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

            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                referrer_uid, 
                'New Referral Registered! 🎉', 
                'User ' || COALESCE(new.raw_user_meta_data->>'full_name', new_username) || ' registered with your referral code! Bonus: ₦' || reward_val, 
                'referral'
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

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: Add missing 'phone' column and enforce uniqueness
DO $$ 
BEGIN 
    -- 1. Add 'phone' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE profiles ADD COLUMN phone text;
    END IF;

    -- 2. Add 'username' column (re-check to be safe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE profiles ADD COLUMN username text;
    END IF;

    -- 3. Now verify/add Unique Constraints
    
    -- Phone Unique
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key') THEN
        -- Only add if column exists (it should now)
        ALTER TABLE profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
    END IF;

    -- Email Unique (Usually exists by default but good to ensure)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;

    -- Username Unique
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;

END $$;

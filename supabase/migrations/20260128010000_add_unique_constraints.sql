-- Ensure unique constraints for phone, email, and username in profiles table

DO $$ 
BEGIN 
    -- 1. Phone Number Uniqueness
    -- Check if constraint exists, if not adds it. 
    -- We assume the column exists (it should).
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key'
    ) THEN
        -- We first attempt to verify data integrity or we just apply it. 
        -- If duplicates exist, this will fail, which is correct behavior (admin needs to fix data).
        ALTER TABLE profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
    END IF;

    -- 2. Email Uniqueness
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;

    -- 3. Username Uniqueness
    -- Previously we tried to add it with the column, but to be sure we add an explicit constraint.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;

END $$;

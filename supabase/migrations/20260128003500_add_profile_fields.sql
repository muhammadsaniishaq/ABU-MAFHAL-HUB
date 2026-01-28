-- Add missing columns to profiles table if they don't exist

DO $$ 
BEGIN 
    -- Username
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE profiles ADD COLUMN username text UNIQUE;
    END IF;

    -- Custom ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'custom_id') THEN
        ALTER TABLE profiles ADD COLUMN custom_id text UNIQUE;
    END IF;

    -- Address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
        ALTER TABLE profiles ADD COLUMN address text;
    END IF;

    -- Gender
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
        ALTER TABLE profiles ADD COLUMN gender text;
    END IF;

    -- Date of Birth
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'dob') THEN
        ALTER TABLE profiles ADD COLUMN dob text;
    END IF;

    -- State
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'state') THEN
        ALTER TABLE profiles ADD COLUMN state text;
    END IF;

    -- Next of Kin Name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'next_of_kin_name') THEN
        ALTER TABLE profiles ADD COLUMN next_of_kin_name text;
    END IF;

    -- Next of Kin Phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'next_of_kin_phone') THEN
        ALTER TABLE profiles ADD COLUMN next_of_kin_phone text;
    END IF;
END $$;

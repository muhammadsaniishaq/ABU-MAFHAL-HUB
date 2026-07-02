-- Add missing columns to profiles table for admin controls

DO $$ 
BEGIN 
    -- KYC Verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'kyc_verified') THEN
        ALTER TABLE profiles ADD COLUMN kyc_verified boolean DEFAULT false;
    END IF;

    -- Transfer Limit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'transfer_limit') THEN
        ALTER TABLE profiles ADD COLUMN transfer_limit numeric;
    END IF;

    -- Admin Notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'admin_notes') THEN
        ALTER TABLE profiles ADD COLUMN admin_notes text;
    END IF;
END $$;

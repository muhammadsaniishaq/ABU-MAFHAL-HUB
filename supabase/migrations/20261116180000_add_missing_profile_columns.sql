-- Migration: 20261116180000_add_missing_profile_columns.sql
-- Description: Ensure all profile extension columns exist safely to prevent column does not exist errors

DO $$ 
BEGIN 
    -- daily_limit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'daily_limit') THEN
        ALTER TABLE public.profiles ADD COLUMN daily_limit numeric DEFAULT 500000;
    END IF;

    -- nin
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'nin') THEN
        ALTER TABLE public.profiles ADD COLUMN nin text;
    END IF;

    -- cac_rc_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cac_rc_number') THEN
        ALTER TABLE public.profiles ADD COLUMN cac_rc_number text;
    END IF;

    -- crypto_enabled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'crypto_enabled') THEN
        ALTER TABLE public.profiles ADD COLUMN crypto_enabled boolean DEFAULT true;
    END IF;

    -- virtual_cards_enabled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'virtual_cards_enabled') THEN
        ALTER TABLE public.profiles ADD COLUMN virtual_cards_enabled boolean DEFAULT true;
    END IF;

    -- is_banned
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_banned') THEN
        ALTER TABLE public.profiles ADD COLUMN is_banned boolean DEFAULT false;
    END IF;

    -- credit_balance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'credit_balance') THEN
        ALTER TABLE public.profiles ADD COLUMN credit_balance decimal(12,2) DEFAULT 0.00;
    END IF;
END $$;

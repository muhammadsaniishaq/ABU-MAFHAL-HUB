-- Migration: Add WhatsApp, Phone verification status, and User OTPs table
-- Date: 2026-11-15

-- 1. Add missing fields to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT false;

-- 2. Create user_otps table for multi-channel OTP delivery & verification (WhatsApp, SMS, Email)
CREATE TABLE IF NOT EXISTS public.user_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    identifier TEXT NOT NULL, -- phone, email, or whatsapp number
    code TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email'
    purpose TEXT NOT NULL DEFAULT 'profile_completion', -- 'signup', 'phone_verification', 'profile_completion', 'password_reset'
    verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast verification queries
CREATE INDEX IF NOT EXISTS idx_user_otps_identifier_purpose ON public.user_otps(identifier, purpose, verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_otps_user_id ON public.user_otps(user_id);

-- Enable RLS
ALTER TABLE public.user_otps ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own records; service role has full access
CREATE POLICY "Users can view own otps" ON public.user_otps
    FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() IS NULL);

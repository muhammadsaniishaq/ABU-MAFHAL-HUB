-- Migration: Create WhatsApp Bot tables and tracking system
-- Enables Meta WhatsApp Cloud API Bot for ABU-MAFHAL-HUB

-- 1. Create whatsapp_bot_sessions table
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_sessions (
    phone_number TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    step TEXT DEFAULT 'IDLE',
    session_data JSONB DEFAULT '{}'::jsonb,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create whatsapp_bot_logs table for audit and debugging
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
    message_type TEXT DEFAULT 'text',
    content TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Indexes for speed and efficiency
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON public.whatsapp_bot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_bot_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_bot_logs(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.whatsapp_bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_bot_logs ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Only service_role and admins have full access
DROP POLICY IF EXISTS "Service role has full access to whatsapp_bot_sessions" ON public.whatsapp_bot_sessions;
CREATE POLICY "Service role has full access to whatsapp_bot_sessions" 
ON public.whatsapp_bot_sessions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to whatsapp_bot_logs" ON public.whatsapp_bot_logs;
CREATE POLICY "Service role has full access to whatsapp_bot_logs" 
ON public.whatsapp_bot_logs 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Admins can view sessions and logs
DROP POLICY IF EXISTS "Admins can view whatsapp_bot_sessions" ON public.whatsapp_bot_sessions;
CREATE POLICY "Admins can view whatsapp_bot_sessions" 
ON public.whatsapp_bot_sessions 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "Admins can view whatsapp_bot_logs" ON public.whatsapp_bot_logs;
CREATE POLICY "Admins can view whatsapp_bot_logs" 
ON public.whatsapp_bot_logs 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

-- 6. Helper RPC function to match user by WhatsApp phone number
CREATE OR REPLACE FUNCTION public.get_user_by_whatsapp_phone(wa_phone TEXT)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    balance NUMERIC,
    transaction_pin TEXT,
    phone TEXT,
    role TEXT
) AS $$
DECLARE
    cleaned_digits TEXT;
    last10 TEXT;
BEGIN
    IF wa_phone IS NULL OR TRIM(wa_phone) = '' THEN
        RETURN;
    END IF;

    cleaned_digits := REGEXP_REPLACE(wa_phone, '\D', '', 'g');
    
    -- Nigerian phone numbers: 2348012345678 or 08012345678 or 8012345678
    IF LENGTH(cleaned_digits) >= 10 THEN
        last10 := RIGHT(cleaned_digits, 10);
    ELSE
        last10 := cleaned_digits;
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.email,
        p.balance,
        p.transaction_pin,
        p.phone,
        p.role
    FROM public.profiles p
    WHERE p.phone IS NOT NULL 
      AND (
          REGEXP_REPLACE(p.phone, '\D', '', 'g') = cleaned_digits
          OR (LENGTH(last10) = 10 AND RIGHT(REGEXP_REPLACE(p.phone, '\D', '', 'g'), 10) = last10)
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_whatsapp_phone(TEXT) TO service_role, authenticated;

-- 7. Seed WhatsApp keys in system_secrets if missing
INSERT INTO public.system_secrets (key, value, description)
VALUES 
    ('WHATSAPP_PHONE_NUMBER_ID', '', 'Meta WhatsApp Cloud API Phone Number ID'),
    ('WHATSAPP_ACCESS_TOKEN', '', 'Meta WhatsApp Cloud API Permanent Access Token'),
    ('WHATSAPP_VERIFY_TOKEN', 'abumafhal_wa_verify_2026', 'Meta WhatsApp Cloud API Webhook Verify Token')
ON CONFLICT (key) DO NOTHING;


-- Migration: 20261021010000_create_esims_suite.sql
-- Description: Create user_esims table with RLS and admin access

CREATE TABLE IF NOT EXISTS public.user_esims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_reference TEXT NOT NULL UNIQUE,
    package_code TEXT NOT NULL,
    country_code TEXT NOT NULL,
    country_name TEXT NOT NULL,
    data_amount TEXT NOT NULL,
    validity_days INTEGER NOT NULL DEFAULT 30,
    iccid TEXT,
    qr_code_url TEXT,
    lpa_activation_code TEXT,
    smdp_address TEXT,
    activation_code TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'EXPIRED', 'DEPLETED', 'FAILED')),
    cost_ngn NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    cost_usd NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_esims_user_id ON public.user_esims(user_id);
CREATE INDEX IF NOT EXISTS idx_user_esims_order_ref ON public.user_esims(order_reference);
CREATE INDEX IF NOT EXISTS idx_user_esims_status ON public.user_esims(status);
CREATE INDEX IF NOT EXISTS idx_user_esims_created_at ON public.user_esims(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_esims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read own esims" ON public.user_esims;
    CREATE POLICY "Users can read own esims"
        ON public.user_esims FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Service role full access to esims" ON public.user_esims;
    CREATE POLICY "Service role full access to esims"
        ON public.user_esims FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Admins have full access to user_esims" ON public.user_esims;
    CREATE POLICY "Admins have full access to user_esims"
        ON public.user_esims FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
            )
        );
END $$;

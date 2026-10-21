-- Migration: 20261021020000_add_category_to_transactions_and_esim_fixes.sql
-- Description: Add category column to transactions, fix eSIM transaction inserts,
--              ensure user_esims table exists with all needed columns.

-- ════════════════════════════════════════════════
-- 1. Add `category` column to transactions if missing
-- ════════════════════════════════════════════════
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS category TEXT;

-- ════════════════════════════════════════════════
-- 2. Ensure transactions has `metadata` JSONB column (for eSIM metadata)
-- ════════════════════════════════════════════════
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- ════════════════════════════════════════════════
-- 3. Ensure user_esims table has raw_response column
--    (in case it was created without it)
-- ════════════════════════════════════════════════
ALTER TABLE public.user_esims
    ADD COLUMN IF NOT EXISTS raw_response JSONB;

ALTER TABLE public.user_esims
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ════════════════════════════════════════════════
-- 4. Grant service_role full access on user_esims
--    (ensures edge functions can insert/update)
-- ════════════════════════════════════════════════
GRANT ALL ON public.user_esims TO service_role;
GRANT ALL ON public.user_esims TO authenticated;

-- ════════════════════════════════════════════════
-- 5. Grant service_role access to transactions
--    (ensures edge functions can insert transactions)
-- ════════════════════════════════════════════════
GRANT ALL ON public.transactions TO service_role;

-- ════════════════════════════════════════════════
-- 6. Drop & recreate RLS policy for user_esims SELECT
--    to guarantee authenticated users can always read own eSIMs
-- ════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════
-- 7. Index on transactions category for fast queries
-- ════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);

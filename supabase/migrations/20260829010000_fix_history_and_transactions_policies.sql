-- Migration: Fix RLS policies & permissions on transactions & verification_history

-- 1. Hardened & Complete RLS on public.transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins and auth users to read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.transactions;

-- Users can SELECT their own transactions, admins can SELECT all
CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Users can INSERT their own transactions, admins can INSERT any
CREATE POLICY "Users can insert own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Users can UPDATE their own transactions, admins can UPDATE any
CREATE POLICY "Users can update own transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Admins can DELETE transactions if needed
CREATE POLICY "Admins can manage all transactions"
    ON public.transactions FOR DELETE
    USING (public.is_admin());

-- 2. Hardened & Complete RLS on public.verification_history
ALTER TABLE public.verification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read verification_history" ON public.verification_history;
DROP POLICY IF EXISTS "Users can view own verification_history" ON public.verification_history;
DROP POLICY IF EXISTS "Admins can view all verification_history" ON public.verification_history;
DROP POLICY IF EXISTS "Users can insert own verification_history" ON public.verification_history;
DROP POLICY IF EXISTS "Users can update own verification_history" ON public.verification_history;
DROP POLICY IF EXISTS "Admins can manage all verification_history" ON public.verification_history;

CREATE POLICY "Users can view own verification_history"
    ON public.verification_history FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own verification_history"
    ON public.verification_history FOR INSERT
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own verification_history"
    ON public.verification_history FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage all verification_history"
    ON public.verification_history FOR DELETE
    USING (public.is_admin());

-- 3. Grants for authenticated and service_role
GRANT ALL ON public.transactions TO authenticated, service_role;
GRANT ALL ON public.verification_history TO authenticated, service_role;

-- Fix RLS on transactions table to prevent 'permission denied for table users'
-- Replace the policy that queried auth.users directly with a clean, safe policy.

DROP POLICY IF EXISTS "Allow admins and auth users to read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
    ON public.transactions FOR SELECT
    USING (public.is_admin());

-- Ensure public.verification_history also has clean RLS
DROP POLICY IF EXISTS "Allow authenticated users to read verification_history" ON public.verification_history;
DROP POLICY IF EXISTS "Users can view own verification_history" ON public.verification_history;

CREATE POLICY "Users can view own verification_history"
    ON public.verification_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification_history"
    ON public.verification_history FOR SELECT
    USING (public.is_admin());

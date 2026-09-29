-- =====================================================================
-- 1. Create crypto_gas_orders table (missing - causing silent insert failures)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.crypto_gas_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    gas_type VARCHAR(20) NOT NULL,
    wallet_address TEXT NOT NULL,
    amount_fiat NUMERIC(14,2) DEFAULT 0,
    amount_gas NUMERIC(20,8) NOT NULL,
    payment_method TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'pending',
    provider_tx_id TEXT,
    tx_hash TEXT,
    error_msg TEXT,
    reference TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.crypto_gas_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gas orders"
    ON public.crypto_gas_orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert gas orders"
    ON public.crypto_gas_orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update gas orders"
    ON public.crypto_gas_orders FOR UPDATE
    USING (true);

CREATE POLICY "Admins can view all gas orders"
    ON public.crypto_gas_orders FOR ALL
    USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_gas_orders_user_id ON public.crypto_gas_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_gas_orders_status ON public.crypto_gas_orders(status);

-- =====================================================================
-- 2. Fix deduct_balance to return JSONB with success field
--    (current version returns NUMERIC - edge fn checks .success which is always NULL)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.deduct_balance(user_id uuid, amount numeric)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_bal NUMERIC;
    new_bal NUMERIC;
BEGIN
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role'
       AND NOT public.is_admin()
       AND (auth.uid() IS NULL OR auth.uid() != user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot deduct balance');
    END IF;

    IF amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid deduction amount');
    END IF;

    SELECT balance INTO current_bal FROM public.profiles WHERE id = user_id FOR UPDATE;

    IF current_bal IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account not found');
    END IF;

    IF current_bal < amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance. Available: ' || current_bal::text || ', Required: ' || amount::text
        );
    END IF;

    new_bal := current_bal - amount;

    PERFORM set_config('app.bypass_profile_lock', 'true', true);

    UPDATE public.profiles
    SET balance = new_bal, updated_at = NOW()
    WHERE id = user_id;

    RETURN jsonb_build_object('success', true, 'new_balance', new_bal);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric) TO authenticated, service_role;

-- =====================================================================
-- 3. Ensure fund_wallet RPC exists for refunds
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fund_wallet(p_user_id uuid, p_amount numeric)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    PERFORM set_config('app.bypass_profile_lock', 'true', true);

    UPDATE public.profiles
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fund_wallet(uuid, numeric) TO service_role;

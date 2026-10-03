-- Migration: 20261002163000_normalize_crypto_balances.sql
-- Consolidate and normalize all crypto balances to canonical tickers (usdt, btc, eth, sol, trx, bnb, ton)

-- 1. Helper function to normalize asset names
CREATE OR REPLACE FUNCTION public.normalize_crypto_asset(asset_input TEXT)
RETURNS TEXT AS $$
DECLARE
    clean TEXT;
BEGIN
    clean := LOWER(TRIM(COALESCE(asset_input, '')));
    IF clean LIKE 'usdt%' THEN
        RETURN 'usdt';
    ELSIF clean LIKE 'usdc%' THEN
        RETURN 'usdc';
    ELSIF clean LIKE 'eth%' THEN
        RETURN 'eth';
    ELSIF clean LIKE 'bnb%' THEN
        RETURN 'bnb';
    ELSIF clean LIKE 'btc%' THEN
        RETURN 'btc';
    ELSIF clean LIKE 'sol%' THEN
        RETURN 'sol';
    ELSIF clean LIKE 'trx%' THEN
        RETURN 'trx';
    ELSIF clean LIKE 'ton%' THEN
        RETURN 'ton';
    ELSE
        RETURN clean;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Consolidate any existing records in crypto_balances
DO $$
DECLARE
    r RECORD;
    target_asset TEXT;
BEGIN
    FOR r IN 
        SELECT id, user_id, asset, balance 
        FROM public.crypto_balances 
        WHERE asset != public.normalize_crypto_asset(asset)
    LOOP
        target_asset := public.normalize_crypto_asset(r.asset);
        
        -- Insert or add to normalized asset row
        INSERT INTO public.crypto_balances (user_id, asset, balance)
        VALUES (r.user_id, target_asset, r.balance)
        ON CONFLICT (user_id, asset)
        DO UPDATE SET 
            balance = public.crypto_balances.balance + r.balance,
            updated_at = NOW();

        -- Delete the non-canonical row
        DELETE FROM public.crypto_balances WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Upgrade credit_crypto_balance RPC to always use canonical asset name
CREATE OR REPLACE FUNCTION public.credit_crypto_balance(
    user_id UUID,
    asset VARCHAR,
    amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    canonical_asset TEXT;
    new_balance NUMERIC;
BEGIN
    -- SECURE: Only allow admins or the system service_role
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' AND NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins or system service role can credit crypto balances');
    END IF;

    -- Normalize asset (e.g. 'usdttrc20' -> 'usdt')
    canonical_asset := public.normalize_crypto_asset(credit_crypto_balance.asset);

    -- Check if balance record exists, if not, create it
    INSERT INTO public.crypto_balances (user_id, asset, balance)
    VALUES (credit_crypto_balance.user_id, canonical_asset, amount)
    ON CONFLICT (user_id, asset)
    DO UPDATE SET 
        balance = public.crypto_balances.balance + amount,
        updated_at = NOW()
    RETURNING balance INTO new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'asset', canonical_asset,
        'new_balance', new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_crypto_balance(UUID, VARCHAR, NUMERIC) TO authenticated, service_role;

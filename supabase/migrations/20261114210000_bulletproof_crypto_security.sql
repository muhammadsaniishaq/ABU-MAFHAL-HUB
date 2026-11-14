-- Migration: 20261114210000_bulletproof_crypto_security.sql
-- Description: Absolute military-grade security hardening for Crypto & Wallet balances
-- 1. Enforce non-negative balance checks
-- 2. Upgrade deduct_crypto_balance & credit_crypto_balance with negative-value guards, asset normalization, and banned-user protection
-- 3. Upgrade credit_balance & deduct_balance with positive amount enforcement

-- 1. Ensure non-negative check constraint on crypto_balances
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'crypto_balances_balance_non_negative'
    ) THEN
        ALTER TABLE public.crypto_balances 
        ADD CONSTRAINT crypto_balances_balance_non_negative CHECK (balance >= 0);
    END IF;
END $$;

-- 2. Upgrade deduct_crypto_balance RPC
CREATE OR REPLACE FUNCTION public.deduct_crypto_balance(
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
    current_balance NUMERIC;
    new_balance NUMERIC;
    user_status TEXT;
    is_user_banned BOOLEAN;
BEGIN
    -- Security Gate 1: Only allow service_role or admin
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' AND NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins or system service role can deduct crypto balances');
    END IF;

    -- Security Gate 2: Amount must be strictly positive and finite
    IF amount IS NULL OR amount <= 0 OR amount != amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount: must be greater than zero');
    END IF;

    -- Security Gate 3: Check user ban / suspension status
    SELECT status, is_banned INTO user_status, is_user_banned 
    FROM public.profiles 
    WHERE id = deduct_crypto_balance.user_id;

    IF is_user_banned = true OR user_status = 'banned' OR user_status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is restricted. Crypto transactions suspended.');
    END IF;

    -- Canonical Asset Normalization
    canonical_asset := public.normalize_crypto_asset(deduct_crypto_balance.asset);

    -- Pessimistic Concurrency Lock (FOR UPDATE prevents race conditions / double-spending)
    SELECT balance INTO current_balance
    FROM public.crypto_balances
    WHERE crypto_balances.user_id = deduct_crypto_balance.user_id 
      AND crypto_balances.asset = canonical_asset
    FOR UPDATE;

    IF current_balance IS NULL OR current_balance < amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient ' || UPPER(canonical_asset) || ' balance'
        );
    END IF;

    -- Deduct balance
    UPDATE public.crypto_balances
    SET 
        balance = balance - amount,
        updated_at = NOW()
    WHERE crypto_balances.user_id = deduct_crypto_balance.user_id 
      AND crypto_balances.asset = canonical_asset
    RETURNING balance INTO new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'asset', canonical_asset,
        'new_balance', new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 3. Upgrade credit_crypto_balance RPC
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
    user_status TEXT;
    is_user_banned BOOLEAN;
BEGIN
    -- Security Gate 1: Only allow service_role or admin
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' AND NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins or system service role can credit crypto balances');
    END IF;

    -- Security Gate 2: Amount must be strictly positive and finite
    IF amount IS NULL OR amount <= 0 OR amount != amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount: must be greater than zero');
    END IF;

    -- Security Gate 3: Check user ban / suspension status
    SELECT status, is_banned INTO user_status, is_user_banned 
    FROM public.profiles 
    WHERE id = credit_crypto_balance.user_id;

    IF is_user_banned = true OR user_status = 'banned' OR user_status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is restricted. Deposit blocked.');
    END IF;

    -- Canonical Asset Normalization
    canonical_asset := public.normalize_crypto_asset(credit_crypto_balance.asset);

    -- Insert or update balance atomically
    INSERT INTO public.crypto_balances (user_id, asset, balance, created_at, updated_at)
    VALUES (credit_crypto_balance.user_id, canonical_asset, amount, NOW(), NOW())
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
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 4. Harden credit_balance with positive amount enforcement & ban check
CREATE OR REPLACE FUNCTION public.credit_balance(user_id uuid, amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance numeric;
  is_user_banned boolean;
  user_status text;
BEGIN
  -- Allow service_role or admin
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' AND NOT public.is_admin() THEN
     RAISE EXCEPTION 'Unauthorized: Only admins can arbitrarily credit balances';
  END IF;

  -- Security Gate: Amount must be strictly positive
  IF amount IS NULL OR amount <= 0 THEN
     RAISE EXCEPTION 'Invalid credit amount: Amount must be greater than zero';
  END IF;

  -- Check if user is banned
  SELECT status, is_banned INTO user_status, is_user_banned FROM public.profiles WHERE id = user_id;
  IF is_user_banned = true OR user_status = 'banned' THEN
     RAISE EXCEPTION 'Account is banned or restricted';
  END IF;

  -- Bypass trigger
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  UPDATE public.profiles
  SET balance = coalesce(balance, 0) + amount,
      updated_at = NOW()
  WHERE id = user_id
  RETURNING balance INTO new_balance;

  RETURN new_balance;
END;
$$;

-- 5. Harden deduct_balance with positive amount enforcement & lock
CREATE OR REPLACE FUNCTION public.deduct_balance(user_id uuid, amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_bal numeric;
  new_bal numeric;
  is_user_banned boolean;
  user_status text;
BEGIN
  -- Allow service_role or admin
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' AND NOT public.is_admin() THEN
     RAISE EXCEPTION 'Unauthorized: Only admins can arbitrarily deduct balances';
  END IF;

  -- Security Gate: Amount must be strictly positive
  IF amount IS NULL OR amount <= 0 THEN
     RAISE EXCEPTION 'Invalid deduct amount: Amount must be greater than zero';
  END IF;

  -- Check if user is banned
  SELECT status, is_banned INTO user_status, is_user_banned FROM public.profiles WHERE id = user_id;
  IF is_user_banned = true OR user_status = 'banned' THEN
     RAISE EXCEPTION 'Account is banned or restricted';
  END IF;

  SELECT balance INTO current_bal FROM public.profiles WHERE id = user_id FOR UPDATE;

  IF current_bal IS NULL OR current_bal < amount THEN
     RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Bypass trigger
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  UPDATE public.profiles
  SET balance = current_bal - amount,
      updated_at = NOW()
  WHERE id = user_id
  RETURNING balance INTO new_bal;

  RETURN new_bal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_crypto_balance(UUID, VARCHAR, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_crypto_balance(UUID, VARCHAR, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric) TO authenticated, service_role;

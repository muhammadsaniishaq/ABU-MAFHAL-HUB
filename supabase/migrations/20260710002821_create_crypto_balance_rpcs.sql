-- Function to safely credit a user's crypto balance
CREATE OR REPLACE FUNCTION credit_crypto_balance(
    user_id UUID,
    asset VARCHAR,
    amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_balance NUMERIC;
BEGIN
    -- Check if balance record exists, if not, create it
    INSERT INTO crypto_balances (user_id, asset, balance)
    VALUES (credit_crypto_balance.user_id, LOWER(credit_crypto_balance.asset), amount)
    ON CONFLICT (user_id, asset)
    DO UPDATE SET 
        balance = crypto_balances.balance + amount,
        updated_at = NOW()
    RETURNING balance INTO new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Function to safely deduct a user's crypto balance
CREATE OR REPLACE FUNCTION deduct_crypto_balance(
    user_id UUID,
    asset VARCHAR,
    amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance NUMERIC;
    new_balance NUMERIC;
BEGIN
    -- Lock the row for update
    SELECT balance INTO current_balance
    FROM crypto_balances
    WHERE crypto_balances.user_id = deduct_crypto_balance.user_id 
      AND crypto_balances.asset = LOWER(deduct_crypto_balance.asset)
    FOR UPDATE;

    IF current_balance IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance'
        );
    END IF;

    IF current_balance < amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance'
        );
    END IF;

    -- Update balance
    UPDATE crypto_balances
    SET 
        balance = balance - amount,
        updated_at = NOW()
    WHERE crypto_balances.user_id = deduct_crypto_balance.user_id 
      AND crypto_balances.asset = LOWER(deduct_crypto_balance.asset)
    RETURNING balance INTO new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION credit_crypto_balance(UUID, VARCHAR, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION deduct_crypto_balance(UUID, VARCHAR, NUMERIC) TO authenticated, service_role;

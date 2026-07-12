-- 1. Patch execute_wallet_transfer to enforce sender_id = auth.uid()
create or replace function public.execute_wallet_transfer(
  sender_id uuid,
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default ''
)
returns jsonb as $$
declare
  v_sender_id uuid;
  sender_bal decimal;
  sender_name text;
  recipient_id uuid;
  recipient_name text;
  recipient_email text;
  reference text;
  result jsonb;
begin
  -- SECURE: Always use the authenticated user's ID
  v_sender_id := auth.uid();
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if sender_id != v_sender_id then
    raise exception 'Unauthorized: You cannot transfer funds on behalf of another user';
  end if;

  -- 1. Find recipient ID and info
  if target_id is not null then
    select id, full_name, email into recipient_id, recipient_name, recipient_email
    from public.profiles
    where id = target_id;
  elsif target_email is not null then
    select id, full_name, email into recipient_id, recipient_name, recipient_email
    from public.profiles
    where email = lower(trim(target_email));
  else
    raise exception 'Either target ID or target email must be provided';
  end if;

  if recipient_id is null then
    raise exception 'Recipient user not found';
  end if;

  if recipient_id = v_sender_id then
    raise exception 'You cannot transfer money to yourself';
  end if;

  if amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  -- 2. Lock and check sender balance
  select balance, full_name into sender_bal, sender_name
  from public.profiles
  where id = v_sender_id for update;

  if sender_bal is null then
    raise exception 'Sender profile not found';
  end if;

  if sender_bal < amount then
    raise exception 'Insufficient balance. Available balance is NGN %', sender_bal;
  end if;

  -- 3. Deduct from sender
  update public.profiles
  set balance = balance - amount
  where id = v_sender_id;

  -- 4. Credit recipient
  update public.profiles
  set balance = balance + amount
  where id = recipient_id;

  -- 5. Create transaction reference
  reference := 'QR-' || extract(epoch from now())::text;

  -- 6. Insert transactions
  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (v_sender_id, 'transfer', amount, 'success', coalesce(note, 'QR Pay to ' || recipient_name), reference || '-OUT');

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (recipient_id, 'deposit', amount, 'success', 'QR Receive from ' || sender_name, reference || '-IN');

  result := jsonb_build_object(
    'success', true,
    'recipient_name', recipient_name,
    'recipient_email', recipient_email,
    'recipient_id', recipient_id
  );
  
  return result;
end;
$$ language plpgsql security definer;


-- 2. Patch submit_cac_request to calculate the price server-side
CREATE OR REPLACE FUNCTION submit_cac_request(
    p_pricing_id UUID,
    p_registration_type TEXT,
    p_proposed_names JSONB,
    p_business_info JSONB,
    p_proprietors JSONB,
    p_chairman JSONB,
    p_secretary JSONB,
    p_trustees JSONB,
    p_aims_and_objectives TEXT,
    p_cost DECIMAL -- Retained for API compatibility but ignored
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_wallet_balance DECIMAL;
    v_actual_cost DECIMAL;
    v_request_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- SECURE: Always fetch the actual price from the database
    SELECT price INTO v_actual_cost
    FROM cac_pricing
    WHERE id = p_pricing_id AND active = true;

    IF v_actual_cost IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive pricing tier';
    END IF;

    -- Get wallet balance with row lock
    SELECT balance INTO v_wallet_balance
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_wallet_balance IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF v_wallet_balance < v_actual_cost THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    -- Deduct actual balance
    UPDATE profiles
    SET balance = balance - v_actual_cost
    WHERE id = v_user_id;

    -- Insert request using the actual cost
    INSERT INTO cac_requests (
        user_id, pricing_id, registration_type, proposed_names, business_info, 
        proprietors, chairman, secretary, trustees, aims_and_objectives, cost_charged
    ) VALUES (
        v_user_id, p_pricing_id, p_registration_type, p_proposed_names, p_business_info,
        p_proprietors, p_chairman, p_secretary, p_trustees, p_aims_and_objectives, v_actual_cost
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;


-- 3. Patch credit_balance to require admin or service_role
create or replace function public.credit_balance(user_id uuid, amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  new_balance numeric;
begin
  -- SECURE: Only allow admins or the system service_role
  if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
     raise exception 'Unauthorized: Only admins can arbitrarily credit balances';
  end if;

  update profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id
  returning balance into new_balance;

  return new_balance;
end;
$$;


-- 4. Patch deduct_balance to require admin or service_role
create or replace function public.deduct_balance(user_id uuid, amount numeric)
returns numeric as $$
declare
  current_bal numeric;
  new_bal numeric;
begin
  -- SECURE: Only allow admins or the system service_role
  if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
     raise exception 'Unauthorized: Only admins can arbitrarily deduct balances';
  end if;

  -- Lock row for update
  select balance into current_bal from public.profiles where id = user_id for update;
  
  if current_bal is null then
    current_bal := 0;
  end if;

  if current_bal < amount then
    raise exception 'Insufficient balance';
  end if;
  
  new_bal := current_bal - amount;
  
  update public.profiles set balance = new_bal where id = user_id;
  
  return new_bal;
end;
$$ language plpgsql security definer;


-- 5. Patch credit_crypto_balance to require admin or service_role
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
    -- SECURE: Only allow admins or the system service_role
    if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins can artificially credit crypto balances');
    end if;

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


-- 6. Patch deduct_crypto_balance to require admin or service_role
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
    -- SECURE: Only allow admins or the system service_role
    if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins can artificially deduct crypto balances');
    end if;

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

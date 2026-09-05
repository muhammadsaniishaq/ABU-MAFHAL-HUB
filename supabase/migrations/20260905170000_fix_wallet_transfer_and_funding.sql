-- Migration: 20260905170000_fix_wallet_transfer_and_funding.sql
-- Description: Fix wallet transfer/withdrawal and funding crediting
-- 1. Update prevent_unauthorized_profile_updates to allow internal bypass via app.bypass_profile_lock
-- 2. Update execute_wallet_transfer to set bypass flag so sender & recipient balances are properly updated
-- 3. Create execute_user_bank_withdrawal to atomically debit balance on bank transfers
-- 4. Update credit_balance and deduct_balance to use bypass flag and guarantee execution

-- 1. UPDATE TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow if called within trusted transaction bypass, or by service_role, or by admin
    IF current_setting('app.bypass_profile_lock', true) = 'true'
       OR (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
       OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- If a normal user directly sends an API update to modify protected fields, revert them
    NEW.balance := OLD.balance;
    NEW.role := OLD.role;
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.referral_balance := OLD.referral_balance;
    NEW.monthly_profit := OLD.monthly_profit;
    NEW.reward_points := OLD.reward_points;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS tr_prevent_unauthorized_profile_updates ON public.profiles;
CREATE TRIGGER tr_prevent_unauthorized_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_profile_updates();


-- 2. UPDATE EXECUTE_WALLET_TRANSFER (P2P Transfer)
CREATE OR REPLACE FUNCTION public.execute_wallet_transfer(
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

  if amount <= 0 then
    raise exception 'Amount must be greater than zero';
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

  -- 3. ENABLE BYPASS FOR THIS TRUSTED TRANSACTION
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  -- 4. Deduct from sender
  update public.profiles
  set balance = balance - amount
  where id = v_sender_id;

  -- 5. Credit recipient
  update public.profiles
  set balance = balance + amount
  where id = recipient_id;

  -- 6. Create transaction reference
  reference := 'TRF-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  -- 7. Insert transactions
  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (v_sender_id, 'transfer', amount, 'success', coalesce(note, 'Transfer to ' || recipient_name), reference || '-OUT');

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (recipient_id, 'deposit', amount, 'success', coalesce(note, 'Transfer received from ' || sender_name), reference || '-IN');

  result := jsonb_build_object(
    'success', true,
    'recipient_name', recipient_name,
    'recipient_email', recipient_email,
    'recipient_id', recipient_id,
    'new_balance', sender_bal - amount,
    'reference', reference
  );
  
  return result;
end;
$$ language plpgsql security definer;


-- 3. CREATE EXECUTE_USER_BANK_WITHDRAWAL (Bank Transfer / Outgoing)
CREATE OR REPLACE FUNCTION public.execute_user_bank_withdrawal(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_narration text default 'Bank Transfer',
  p_user_id uuid default null
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_current_bal numeric;
  v_new_bal numeric;
  v_ref text;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and p_user_id != auth.uid() then
    if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
       raise exception 'Unauthorized';
    end if;
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  -- Lock user profile row
  select balance into v_current_bal
  from public.profiles
  where id = v_user_id for update;

  if v_current_bal is null or v_current_bal < p_amount then
    raise exception 'Insufficient balance. Available balance: NGN %', coalesce(v_current_bal, 0);
  end if;

  v_new_bal := v_current_bal - p_amount;

  -- Bypass trigger for this atomic transaction
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  -- Deduct user balance
  update public.profiles
  set balance = v_new_bal
  where id = v_user_id;

  v_ref := 'WTH-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  -- Record transaction
  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (
    v_user_id, 
    'withdrawal', 
    p_amount, 
    'success', 
    coalesce(p_narration, 'Transfer to ' || p_bank_name || ' (' || p_account_number || ')') || ' - ' || p_account_name,
    v_ref
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_bal,
    'reference', v_ref,
    'amount', p_amount,
    'bank_name', p_bank_name,
    'account_number', p_account_number,
    'account_name', p_account_name
  );
end;
$$ language plpgsql security definer;


-- 4. UPDATE CREDIT_BALANCE AND DEDUCT_BALANCE
CREATE OR REPLACE FUNCTION public.credit_balance(user_id uuid, amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  new_balance numeric;
begin
  -- Allow service_role or admin
  if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
     raise exception 'Unauthorized: Only admins can arbitrarily credit balances';
  end if;

  -- Bypass trigger
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id
  returning balance into new_balance;

  return new_balance;
end;
$$;

CREATE OR REPLACE FUNCTION public.deduct_balance(user_id uuid, amount numeric)
returns numeric as $$
declare
  current_bal numeric;
  new_bal numeric;
begin
  -- Allow service_role or admin
  if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
     raise exception 'Unauthorized: Only admins can arbitrarily deduct balances';
  end if;

  select balance into current_bal from public.profiles where id = user_id for update;

  if current_bal is null or current_bal < amount then
     raise exception 'Insufficient balance';
  end if;

  -- Bypass trigger
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = balance - amount
  where id = user_id
  returning balance into new_bal;

  return new_bal;
end;
$$ language plpgsql security definer;

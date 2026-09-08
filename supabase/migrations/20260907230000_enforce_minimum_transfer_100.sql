-- Migration: 20260907230000_enforce_minimum_transfer_100.sql
-- Description: Enforce strict minimum transfer of NGN 100 on bank withdrawals and P2P transfers

-- 0. Ensure details and metadata columns exist on public.transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 1. Drop overloaded signatures and enforce minimum NGN 100 on execute_user_bank_withdrawal
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal(numeric, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal(numeric, text, text, text, text, uuid, numeric);
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal;

CREATE OR REPLACE FUNCTION public.execute_user_bank_withdrawal(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_narration text default 'Bank Transfer',
  p_user_id uuid default null,
  p_fee numeric default 0
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_current_bal numeric;
  v_fee numeric;
  v_total_debit numeric;
  v_new_bal numeric;
  v_ref text;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and (auth.uid() is null or p_user_id != auth.uid()) then
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') != 'service_role'
       and coalesce(auth.role(), '') != 'service_role'
       and current_user not in ('service_role', 'postgres')
       and not public.is_admin() then
       raise exception 'Unauthorized';
    end if;
  end if;

  -- ENFORCE MINIMUM TRANSFER 100 NAIRA
  if p_amount < 100 then
    raise exception 'Minimum transfer amount is NGN 100.00. Current amount: NGN %', p_amount;
  end if;

  v_fee := coalesce(p_fee, 0);
  v_total_debit := p_amount + v_fee;

  -- Lock user profile row
  select balance into v_current_bal
  from public.profiles
  where id = v_user_id for update;

  if v_current_bal is null or v_current_bal < v_total_debit then
    raise exception 'Insufficient balance. Available balance: NGN %, Total Required: NGN %', coalesce(v_current_bal, 0), v_total_debit;
  end if;

  v_new_bal := v_current_bal - v_total_debit;

  -- Bypass trigger for this atomic transaction
  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  -- Deduct user balance by total debit (amount + fee)
  update public.profiles
  set balance = v_new_bal
  where id = v_user_id;

  v_ref := 'WTH-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  -- Record transaction
  insert into public.transactions (user_id, type, amount, status, description, reference, details)
  values (
    v_user_id, 
    'withdrawal', 
    p_amount, 
    'success', 
    coalesce(p_narration, 'Transfer to ' || p_bank_name || ' (' || p_account_number || ')') || ' - ' || p_account_name,
    v_ref,
    jsonb_build_object(
      'fee', v_fee,
      'total_debit', v_total_debit,
      'bank_name', p_bank_name,
      'account_number', p_account_number,
      'account_name', p_account_name,
      'provider', 'flutterwave'
    )
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_bal,
    'reference', v_ref,
    'amount', p_amount,
    'fee', v_fee,
    'total_debit', v_total_debit,
    'bank_name', p_bank_name,
    'account_number', p_account_number,
    'account_name', p_account_name
  );
end;
$$ language plpgsql security definer;

-- 2. Enforce minimum NGN 100 on execute_wallet_transfer (P2P)
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
  v_sender_id := auth.uid();
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if sender_id != v_sender_id then
    raise exception 'Unauthorized: You cannot transfer funds on behalf of another user';
  end if;

  -- ENFORCE MINIMUM TRANSFER 100 NAIRA
  if amount < 100 then
    raise exception 'Minimum transfer amount is NGN 100.00. Current amount: NGN %', amount;
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

  -- 6. Generate Reference
  reference := 'P2P-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  -- 7. Insert sender transaction
  insert into public.transactions (user_id, type, amount, status, description, reference, details)
  values (
    v_sender_id,
    'transfer',
    amount,
    'success',
    'Transfer to ' || coalesce(recipient_name, recipient_email, 'Member') || case when note != '' then ' (' || note || ')' else '' end,
    reference,
    jsonb_build_object(
      'recipient_id', recipient_id,
      'recipient_name', recipient_name,
      'recipient_email', recipient_email,
      'note', note,
      'direction', 'outgoing'
    )
  );

  -- 8. Insert recipient transaction
  insert into public.transactions (user_id, type, amount, status, description, reference, details)
  values (
    recipient_id,
    'deposit',
    amount,
    'success',
    'Received from ' || coalesce(sender_name, 'Member') || case when note != '' then ' (' || note || ')' else '' end,
    reference || '-IN',
    jsonb_build_object(
      'sender_id', v_sender_id,
      'sender_name', sender_name,
      'note', note,
      'direction', 'incoming'
    )
  );

  -- 9. Notify recipient
  insert into public.notifications (user_id, title, message, type)
  values (
    recipient_id,
    'Money Received!',
    'You received NGN ' || amount::text || ' from ' || coalesce(sender_name, 'a member') || '.',
    'credit'
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', (sender_bal - amount),
    'reference', reference,
    'recipient', coalesce(recipient_name, recipient_email),
    'amount', amount
  );
end;
$$ language plpgsql security definer;

-- 3. Create execute_p2p_transfer as alias to execute_wallet_transfer
CREATE OR REPLACE FUNCTION public.execute_p2p_transfer(
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default ''
)
returns jsonb as $$
begin
  return public.execute_wallet_transfer(
    sender_id := auth.uid(),
    target_id := target_id,
    target_email := target_email,
    amount := amount,
    note := note
  );
end;
$$ language plpgsql security definer;

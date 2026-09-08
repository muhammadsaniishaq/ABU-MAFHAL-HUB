-- Migration: 20260908130000_enforce_tier2_and_pin_on_transfers.sql
-- Description: Strictly enforce Tier 2+ KYC requirement, account status checks, transaction PIN verification, and daily velocity limits on transfers and withdrawals.

-- 1. DROP OVERLOADED SIGNATURES FOR CLEAN REPLACEMENT
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal(numeric, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal(numeric, text, text, text, text, uuid, numeric);
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal;

-- 2. HARDENED EXECUTE_USER_BANK_WITHDRAWAL (Enforces Tier 2+ & Active Status)
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
  v_user_tier integer;
  v_user_status text;
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

  -- Lock user profile row and verify KYC Tier + Status
  select balance, coalesce(kyc_tier, 1), coalesce(status, 'active')
  into v_current_bal, v_user_tier, v_user_status
  from public.profiles
  where id = v_user_id for update;

  if v_user_status in ('suspended', 'banned', 'frozen', 'restricted') then
    raise exception 'Your account is currently restricted. Withdrawals and transfers are disabled.';
  end if;

  -- STRICT TIER 2+ ENFORCEMENT
  if v_user_tier < 2 then
    raise exception 'Withdrawal locked: In compliance with financial security regulations, you must upgrade your account to Tier 2 (verify your BVN or NIN) before you can withdraw or transfer funds.';
  end if;

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
    'total_debit', v_total_debit,
    'bank_name', p_bank_name,
    'account_number', p_account_number,
    'account_name', p_account_name
  );
end;
$$ language plpgsql security definer;

-- 3. DROP OVERLOADED SIGNATURES FOR WALLET TRANSFER
DROP FUNCTION IF EXISTS public.execute_wallet_transfer(uuid, uuid, text, decimal, text);
DROP FUNCTION IF EXISTS public.execute_wallet_transfer(uuid, uuid, text, decimal, text, text);
DROP FUNCTION IF EXISTS public.execute_wallet_transfer;

-- 4. HARDENED EXECUTE_WALLET_TRANSFER (Enforces Tier 2+, PIN, Status, and Daily Velocity Limits)
CREATE OR REPLACE FUNCTION public.execute_wallet_transfer(
  sender_id uuid,
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default '',
  p_pin text default null
)
returns jsonb as $$
declare
  v_sender_id uuid;
  sender_bal decimal;
  sender_name text;
  sender_tier integer;
  sender_status text;
  sender_pin text;
  recipient_id uuid;
  recipient_name text;
  recipient_email text;
  reference text;
  v_used_today numeric;
  v_max_single numeric;
  v_daily_limit numeric;
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

  -- 1. Lock and check sender profile, status, pin, and KYC Tier
  select balance, full_name, coalesce(kyc_tier, 1), coalesce(status, 'active'), transaction_pin
  into sender_bal, sender_name, sender_tier, sender_status, sender_pin
  from public.profiles
  where id = v_sender_id for update;

  if sender_bal is null then
    raise exception 'Sender profile not found';
  end if;

  -- Check Account Status
  if sender_status in ('suspended', 'banned', 'frozen', 'restricted') then
    raise exception 'Your account is currently restricted. Transfers are disabled. Please contact customer support.';
  end if;

  -- STRICT TIER 2+ ENFORCEMENT (Transfer is locked for Tier 1 users)
  if sender_tier < 2 then
    raise exception 'Transfer locked: In compliance with financial regulations, you must upgrade your account to Tier 2 (verify BVN or NIN) before you can transfer funds.';
  end if;

  -- VERIFY TRANSACTION PIN
  if sender_pin is not null and sender_pin != '' then
    if p_pin is null or trim(p_pin) != trim(sender_pin) then
      raise exception 'Invalid transaction PIN. Transfer authorization failed.';
    end if;
  end if;

  -- DAILY TRANSFER LIMIT CHECK FOR P2P
  v_max_single := case when sender_tier >= 3 then 5000000 else 500000 end;
  v_daily_limit := case when sender_tier >= 3 then 10000000 else 2000000 end;

  if amount > v_max_single then
    raise exception 'Amount exceeds maximum single transfer limit of NGN % for Tier %', v_max_single, sender_tier;
  end if;

  select coalesce(sum(t.amount), 0) into v_used_today
  from public.transactions t
  where t.user_id = v_sender_id
    and t.type in ('withdrawal', 'transfer')
    and t.status in ('success', 'pending', 'processing')
    and t.created_at >= (now() - interval '24 hours');

  if (v_used_today + amount) > v_daily_limit then
    raise exception 'Daily transfer limit of NGN % exceeded. You have used NGN % today.', v_daily_limit, v_used_today;
  end if;

  -- 2. Find recipient ID and info
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
    'transfer',
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

  -- 9. Notify recipient (populate body, message, and massage for complete schema resilience)
  insert into public.notifications (user_id, title, body, message, massage, type)
  values (
    recipient_id,
    'Money Received!',
    'You received NGN ' || amount::text || ' from ' || coalesce(sender_name, 'a member') || '.',
    'You received NGN ' || amount::text || ' from ' || coalesce(sender_name, 'a member') || '.',
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

-- 5. RE-CREATE EXECUTE_P2P_TRANSFER AS COMPATIBILITY ALIAS
DROP FUNCTION IF EXISTS public.execute_p2p_transfer(uuid, text, decimal, text);
DROP FUNCTION IF EXISTS public.execute_p2p_transfer(uuid, text, decimal, text, text);
DROP FUNCTION IF EXISTS public.execute_p2p_transfer;

CREATE OR REPLACE FUNCTION public.execute_p2p_transfer(
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default '',
  p_pin text default null
)
returns jsonb as $$
begin
  return public.execute_wallet_transfer(
    sender_id := auth.uid(),
    target_id := target_id,
    target_email := target_email,
    amount := amount,
    note := note,
    p_pin := p_pin
  );
end;
$$ language plpgsql security definer;

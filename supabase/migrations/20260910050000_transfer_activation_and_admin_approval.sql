-- Migration: 20260910050000_transfer_activation_and_admin_approval.sql
-- Description: Add dedicated Transfer Activation approval workflow, Tier 3 prerequisite, and 24-hour security cooldown.

-- 1. ADD TRANSFER ACCESS COLUMNS TO PROFILES
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS transfer_status text DEFAULT 'not_applied',
ADD COLUMN IF NOT EXISTS transfer_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS transfer_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS transfer_unlock_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS transfer_rejection_reason text;

-- Strict requirement: Every user (including Tier 3 users) must submit an application request
-- and be approved by an Admin before transfers can be activated.
UPDATE public.profiles
SET 
  transfer_status = 'not_applied',
  transfer_approved = false,
  transfer_approved_at = null,
  transfer_unlock_at = null
WHERE id NOT IN (
  SELECT user_id FROM public.transfer_activation_requests WHERE status = 'approved'
);

-- 2. CREATE DEDICATED TRANSFER ACTIVATION REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.transfer_activation_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  occupation text NOT NULL,
  employer_business_name text NOT NULL,
  purpose text NOT NULL,
  estimated_monthly_volume text NOT NULL,
  average_transfer_amount text NOT NULL,
  source_of_funds text NOT NULL,
  originating_bank text,
  residential_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  nearest_landmark text,
  next_of_kin_name text NOT NULL,
  next_of_kin_relationship text NOT NULL,
  next_of_kin_phone text NOT NULL,
  id_type text NOT NULL,
  id_number text NOT NULL,
  aml_agreement boolean DEFAULT true,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.transfer_activation_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own transfer activation requests" ON public.transfer_activation_requests;
DROP POLICY IF EXISTS "Users can insert own transfer activation request" ON public.transfer_activation_requests;
DROP POLICY IF EXISTS "Admins can view and update all transfer activation requests" ON public.transfer_activation_requests;

-- User Policies
CREATE POLICY "Users can view own transfer activation requests"
ON public.transfer_activation_requests FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own transfer activation request"
ON public.transfer_activation_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin Policy
CREATE POLICY "Admins can view and update all transfer activation requests"
ON public.transfer_activation_requests FOR ALL
USING (public.is_admin());

-- Realtime publication (Safe idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'transfer_activation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_activation_requests;
  END IF;
END $$;

-- 3. HARDENED EXECUTE_USER_BANK_WITHDRAWAL (Enforces Tier 3, Admin Approval, and 24hr Cooldown)
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
  v_transfer_status text;
  v_transfer_approved boolean;
  v_transfer_unlock_at timestamp with time zone;
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

  -- Lock user profile row and verify KYC Tier, Status, Transfer Status & Cooldown
  select balance, coalesce(kyc_tier, 1), coalesce(status, 'active'), coalesce(transfer_status, 'not_applied'), coalesce(transfer_approved, false), transfer_unlock_at
  into v_current_bal, v_user_tier, v_user_status, v_transfer_status, v_transfer_approved, v_transfer_unlock_at
  from public.profiles
  where id = v_user_id for update;

  if v_user_status in ('suspended', 'banned', 'frozen', 'restricted') then
    raise exception 'Your account is currently restricted. Withdrawals and transfers are disabled.';
  end if;

  -- STRICT TIER 3 PREREQUISITE (Staff / Admins exempt)
  if v_user_tier < 3 and not public.is_admin() then
    raise exception 'Transfer locked: In compliance with financial security regulations, you must upgrade your account to Tier 3 before you can apply for or use transfer privileges.';
  end if;

  -- STRICT ADMIN APPROVAL REQUIREMENT (Staff / Admins exempt)
  if (v_transfer_status != 'approved' or not v_transfer_approved) and not public.is_admin() then
    raise exception 'Transfer locked: Your transfer access application is either pending review or has not yet been approved by compliance administration.';
  end if;

  -- 24-HOUR MATURATION COOLDOWN REQUIREMENT (Staff / Admins exempt)
  if v_transfer_unlock_at is not null and now() < v_transfer_unlock_at and not public.is_admin() then
    raise exception 'Security maturation period active. For account safety, transfers unlock in %.', 
      to_char(v_transfer_unlock_at - now(), 'HH24 hours MI minutes');
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
    'total_debit', v_total_debit,
    'fee', v_fee,
    'reference', v_ref
  );
end;
$$ language plpgsql security definer;

-- 4. HARDENED EXECUTE_WALLET_TRANSFER (Enforces Tier 3, Admin Approval, and 24hr Cooldown)
CREATE OR REPLACE FUNCTION public.execute_wallet_transfer(
  sender_id uuid,
  amount numeric,
  target_email text default null,
  target_id uuid default null,
  p_pin text default null
)
returns jsonb as $$
declare
  v_sender_id uuid;
  sender_bal numeric;
  sender_name text;
  sender_tier integer;
  sender_status text;
  sender_pin text;
  sender_transfer_status text;
  sender_transfer_approved boolean;
  sender_transfer_unlock_at timestamp with time zone;
  recipient_id uuid;
  recipient_name text;
  recipient_email text;
  reference text;
  v_max_single numeric;
  v_daily_limit numeric;
  v_used_today numeric;
begin
  v_sender_id := coalesce(sender_id, auth.uid());
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() is not null and auth.uid() != v_sender_id and not public.is_admin() then
    raise exception 'Unauthorized: You cannot transfer funds on behalf of another user';
  end if;

  -- ENFORCE MINIMUM TRANSFER 100 NAIRA
  if amount < 100 then
    raise exception 'Minimum transfer amount is NGN 100.00. Current amount: NGN %', amount;
  end if;

  -- 1. Lock and check sender profile, status, pin, KYC Tier, Transfer Status & Cooldown
  select balance, full_name, coalesce(kyc_tier, 1), coalesce(status, 'active'), transaction_pin,
         coalesce(transfer_status, 'not_applied'), coalesce(transfer_approved, false), transfer_unlock_at
  into sender_bal, sender_name, sender_tier, sender_status, sender_pin,
       sender_transfer_status, sender_transfer_approved, sender_transfer_unlock_at
  from public.profiles
  where id = v_sender_id for update;

  if sender_bal is null then
    raise exception 'Sender profile not found';
  end if;

  -- Check Account Status
  if sender_status in ('suspended', 'banned', 'frozen', 'restricted') then
    raise exception 'Your account is currently restricted. Transfers are disabled. Please contact customer support.';
  end if;

  -- STRICT TIER 3 PREREQUISITE (Staff / Admins exempt)
  if sender_tier < 3 and not public.is_admin() then
    raise exception 'Transfer locked: In compliance with financial regulations, you must upgrade your account to Tier 3 before you can apply for or use transfer privileges.';
  end if;

  -- STRICT ADMIN APPROVAL REQUIREMENT (Staff / Admins exempt)
  if (sender_transfer_status != 'approved' or not sender_transfer_approved) and not public.is_admin() then
    raise exception 'Transfer Access Locked: Your transfer privileges have not been approved by an administrator. Please submit a transfer activation request.';
  end if;

  -- MANDATORY 24-HOUR MATURATION COOLDOWN (Staff / Admins exempt)
  if sender_transfer_unlock_at is not null and now() < sender_transfer_unlock_at and not public.is_admin() then
    raise exception 'Transfer Security Cooldown Active: Your transfer privileges are in the mandatory 24-hour security maturation period. Transfers will unlock at % (UTC).', sender_transfer_unlock_at;
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
    'Transfer to ' || recipient_name,
    reference,
    jsonb_build_object(
      'recipient_id', recipient_id,
      'recipient_name', recipient_name,
      'recipient_email', recipient_email
    )
  );

  -- 8. Insert recipient transaction
  insert into public.transactions (user_id, type, amount, status, description, reference, details)
  values (
    recipient_id,
    'transfer',
    amount,
    'success',
    'Transfer received from ' || sender_name,
    reference || '-REC',
    jsonb_build_object(
      'sender_id', v_sender_id,
      'sender_name', sender_name
    )
  );

  return jsonb_build_object(
    'success', true,
    'reference', reference,
    'amount', amount,
    'recipient_name', recipient_name,
    'new_balance', sender_bal - amount
  );
end;
$$ language plpgsql security definer;

-- Migration: 20260907120000_add_fee_and_flutterwave_to_withdrawal.sql
-- Description: Update execute_user_bank_withdrawal to handle p_fee, debit total (amount + fee), and support Flutterwave metadata

-- 0. Ensure details and metadata columns exist on public.transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS session_id TEXT;

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

  if p_user_id is not null and p_user_id != auth.uid() then
    if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
       raise exception 'Unauthorized';
    end if;
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
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

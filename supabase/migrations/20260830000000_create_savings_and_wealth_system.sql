-- Migration: Comprehensive Enterprise Savings & Wealth Asset Ledger System
-- Date: 2026-08-30

-- 1. Create savings_plans table
create table if not exists public.savings_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_type text not null default 'flexible', -- flexible, fixed_30, fixed_90, fixed_180, fixed_365, halal, gold
  title text not null,
  amount_saved numeric not null default 0 check (amount_saved >= 0),
  target_amount numeric not null default 0 check (target_amount >= 0),
  frequency text default 'Daily', -- Daily, Weekly, Monthly, Manual
  apy_rate numeric default 10.0,
  lock_until timestamp with time zone,
  status text default 'active' check (status in ('active', 'matured', 'locked', 'liquidated')),
  accrued_interest numeric default 0 check (accrued_interest >= 0),
  auto_rollover boolean default false,
  shariah_compliant boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.savings_plans enable row level security;

-- Policies for savings_plans
create policy "Users can view their own savings plans"
  on public.savings_plans for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users can create their own savings plans"
  on public.savings_plans for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Users can update their own savings plans"
  on public.savings_plans for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Admins have full access to savings plans"
  on public.savings_plans for all
  using (public.is_admin());

-- 2. Create wealth_asset_pools table
create table if not exists public.wealth_asset_pools (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  category text not null default 'Treasury',
  total_allocated numeric not null default 0 check (total_allocated >= 0),
  target_yield numeric not null default 12.0,
  risk_tier text not null default 'Low Risk (Sovereign)',
  status text not null default 'active' check (status in ('active', 'rebalancing', 'paused')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.wealth_asset_pools enable row level security;

create policy "Everyone can view active asset pools"
  on public.wealth_asset_pools for select
  using (true);

create policy "Admins can manage asset pools"
  on public.wealth_asset_pools for all
  using (public.is_admin());

-- 3. Atomic RPC: Create User Savings Plan with optional initial funding
create or replace function public.create_user_savings_plan(
  p_title text,
  p_target_amount numeric,
  p_plan_type text,
  p_initial_deposit numeric default 0,
  p_frequency text default 'Daily',
  p_apy_rate numeric default 10.0,
  p_lock_days integer default 0
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_balance numeric;
  v_plan_id uuid;
  v_lock_until timestamp with time zone := null;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_lock_days > 0 then
    v_lock_until := now() + (p_lock_days || ' days')::interval;
  end if;

  -- If initial deposit requested, check and deduct wallet balance
  if p_initial_deposit > 0 then
    select balance into v_balance from public.profiles where id = v_user_id for update;
    if v_balance < p_initial_deposit then
      return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance for initial deposit');
    end if;

    -- Deduct balance
    update public.profiles
    set balance = balance - p_initial_deposit,
        updated_at = now()
    where id = v_user_id;

    -- Record transaction
    insert into public.transactions (
      user_id,
      type,
      amount,
      status,
      description,
      reference
    ) values (
      v_user_id,
      'savings_deposit',
      p_initial_deposit,
      'completed',
      'Initial deposit for savings goal: ' || p_title,
      'SAV-' || floor(extract(epoch from now())) || '-' || floor(random() * 1000)
    );
  end if;

  -- Create savings plan row
  insert into public.savings_plans (
    user_id,
    title,
    target_amount,
    amount_saved,
    plan_type,
    frequency,
    apy_rate,
    lock_until,
    status,
    shariah_compliant
  ) values (
    v_user_id,
    p_title,
    p_target_amount,
    p_initial_deposit,
    p_plan_type,
    p_frequency,
    p_apy_rate,
    v_lock_until,
    'active',
    (p_plan_type = 'halal')
  ) returning id into v_plan_id;

  return jsonb_build_object(
    'success', true,
    'plan_id', v_plan_id,
    'amount_saved', p_initial_deposit
  );
end;
$$;

-- 4. Atomic RPC: Deposit Additional Funds to Savings Plan
create or replace function public.deposit_to_savings(
  p_plan_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_balance numeric;
  v_plan_title text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Deposit amount must be greater than zero');
  end if;

  -- Check plan ownership
  select title into v_plan_title
  from public.savings_plans
  where id = p_plan_id and user_id = v_user_id and status = 'active';

  if v_plan_title is null then
    return jsonb_build_object('success', false, 'error', 'Active savings plan not found');
  end if;

  -- Deduct wallet
  select balance into v_balance from public.profiles where id = v_user_id for update;
  if v_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
  end if;

  update public.profiles
  set balance = balance - p_amount,
      updated_at = now()
  where id = v_user_id;

  -- Credit savings plan
  update public.savings_plans
  set amount_saved = amount_saved + p_amount,
      updated_at = now()
  where id = p_plan_id;

  -- Record transaction
  insert into public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    reference
  ) values (
    v_user_id,
    'savings_deposit',
    p_amount,
    'completed',
    'Deposit to savings: ' || v_plan_title,
    'SAV-DEP-' || floor(extract(epoch from now()))
  );

  return jsonb_build_object('success', true, 'message', 'Funds saved successfully');
end;
$$;

-- 5. Atomic RPC: Withdraw / Liquidate Savings Plan to Wallet
create or replace function public.liquidate_savings_plan(
  p_plan_id uuid,
  p_is_admin boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_plan record;
  v_payout_amount numeric;
  v_penalty numeric := 0;
  v_is_early boolean := false;
begin
  if p_is_admin and public.is_admin() then
    select * into v_plan from public.savings_plans where id = p_plan_id for update;
  else
    v_user_id := auth.uid();
    select * into v_plan from public.savings_plans where id = p_plan_id and user_id = v_user_id for update;
  end if;

  if v_plan.id is null then
    return jsonb_build_object('success', false, 'error', 'Savings plan not found');
  end if;

  if v_plan.status = 'liquidated' then
    return jsonb_build_object('success', false, 'error', 'Plan has already been liquidated');
  end if;

  -- Check early lock break penalty
  if v_plan.lock_until is not null and now() < v_plan.lock_until and not p_is_admin then
    v_is_early := true;
    v_penalty := (v_plan.amount_saved * 0.03); -- 3% break penalty
  end if;

  v_payout_amount := (v_plan.amount_saved + v_plan.accrued_interest) - v_penalty;
  if v_payout_amount < 0 then
    v_payout_amount := 0;
  end if;

  -- Credit user wallet
  update public.profiles
  set balance = balance + v_payout_amount,
      updated_at = now()
  where id = v_plan.user_id;

  -- Mark plan as liquidated
  update public.savings_plans
  set status = 'liquidated',
      amount_saved = 0,
      updated_at = now()
  where id = v_plan.id;

  -- Record transaction
  insert into public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    reference
  ) values (
    v_plan.user_id,
    'savings_withdrawal',
    v_payout_amount,
    'completed',
    'Liquidated savings: ' || v_plan.title || (case when v_is_early then ' (Early break fee applied)' else '' end),
    'SAV-WD-' || floor(extract(epoch from now()))
  );

  return jsonb_build_object(
    'success', true,
    'payout_amount', v_payout_amount,
    'penalty_deducted', v_penalty
  );
end;
$$;

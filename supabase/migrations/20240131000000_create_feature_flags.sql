-- Create feature_flags table
create table if not exists public.feature_flags (
  feature_key text primary key,
  label text not null,
  is_enabled boolean default true,
  maintenance_message text default 'This feature is currently under maintenance.',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.feature_flags enable row level security;

-- Drop existing policies to ensure idempotency
drop policy if exists "Allow public read access" on public.feature_flags;
drop policy if exists "Allow authenticated update" on public.feature_flags;
drop policy if exists "Allow authenticated insert" on public.feature_flags;

-- Create policies
-- Everyone can read feature flags (so the app knows what to hide)
create policy "Allow public read access"
  on public.feature_flags for select
  using (true);

-- Only admins/service role can update (assuming standard admin checks or service role usage for admin panel)
-- For simplicity in this context, we'll allow authenticated users to update if they are admins, 
-- but often admin panels use the service role or a specific admin claim. 
-- Adjust this policy based on your specific admin auth implementation.
create policy "Allow authenticated update"
  on public.feature_flags for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Allow authenticated insert"
  on public.feature_flags for insert
  with check (auth.role() = 'authenticated');


-- Seed default features
insert into public.feature_flags (feature_key, label, is_enabled)
values 
  ('trading_spot', 'Spot Trading', true),
  ('trading_futures', 'Futures Trading', true),
  ('trading_earn', 'Earn Program', true),
  ('wallet_deposit_bank', 'Bank Deposit', true),
  ('wallet_deposit_card', 'Card Payment', true),
  ('p2p_trading', 'P2P Trading', true),
  ('feature_transfer', 'Transfer', true),
  ('feature_airtime', 'Airtime', true),
  ('feature_data', 'Data', true),
  ('feature_education', 'Education', true),
  ('feature_bills', 'Bills Payment', true),
  ('feature_cards', 'Virtual Cards', true),
  ('feature_savings', 'Savings', true),
  ('feature_loans', 'Loans', true),
  ('feature_crypto', 'Crypto Trading', true),
  ('feature_analytics', 'Insights / Analytics', true),
  ('feature_rewards', 'Rewards', true),
  ('feature_qr', 'QR Pay', true),
  ('feature_invest', 'Investments', true),
  ('feature_insurance', 'Insurance', true),
  ('feature_bvn', 'BVN Services', true),
  ('feature_nin', 'NIN Services', true)
on conflict (feature_key) do nothing;

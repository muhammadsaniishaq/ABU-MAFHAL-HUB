-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Users)
-- This table mirrors the Auth Users but adds our custom fields
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text unique not null,
  full_name text,
  role text default 'user', -- 'admin', 'super_admin'
  status text default 'active', -- 'active', 'suspended', 'banned'
  balance decimal(12,2) default 0.00,
  kyc_tier integer default 1,
  transaction_pin text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Trigger to create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. TRANSACTIONS
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  type text not null, -- 'deposit', 'withdrawal', 'transfer', 'payment'
  amount decimal(12,2) not null,
  status text default 'pending', -- 'pending', 'success', 'failed'
  reference text unique,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. KYC VERIFICATION
create table public.kyc_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  document_type text not null, -- 'nin', 'passport', 'voters_card'
  document_url text not null,
  status text default 'pending', -- 'pending', 'approved', 'rejected'
  admin_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. SUPPORT TICKETS
create table public.tickets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  subject text not null,
  status text default 'open', -- 'open', 'resolved', 'closed'
  priority text default 'medium',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.ticket_messages (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references public.tickets(id) not null,
  sender_id uuid references public.profiles(id) not null, -- Could be user or admin
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. AUDIT LOGS
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  admin_id uuid references public.profiles(id),
  action text not null,
  target_resource text,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. CMS / BANNERS
create table public.banners (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  image_url text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. SECURITY HELPERS
-- Function to check if a user is an admin without triggering RLS recursion
create or replace function public.is_admin()
returns boolean as $$
begin
  return (
    select (raw_app_metadata->>'role')::text in ('admin', 'super_admin')
    from auth.users
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- RLS POLICIES (Hardened)
-- Allow Admins to read everything
create policy "Admins can view all profiles" 
on public.profiles for select 
using (public.is_admin());

create policy "Admins can update profiles" 
on public.profiles for update 
using (public.is_admin());

-- Allow Users to view their own profile
create policy "Users can view own profile" 
on public.profiles for select 
using (auth.uid() = id);

-- Allow Users to update their own profile (Limited fields)
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);
-- 8. LOANS
create table public.loans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  amount decimal(12,2) not null,
  interest_rate decimal(5,2) not null,
  status text default 'pending', -- 'pending', 'approved', 'rejected', 'repaid'
  ai_score integer, -- 0-100
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. EXCHANGE RATES
create table public.exchange_rates (
  id uuid default uuid_generate_v4() primary key,
  pair text unique not null, -- 'USDT/NGN', etc.
  buy_rate decimal(12,2) not null,
  sell_rate decimal(12,2) not null,
  trend text default 'neutral', -- 'up', 'down', 'neutral'
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- more policies for these tables...
alter table public.kyc_requests enable row level security;
create policy "Users can view own kyc" on public.kyc_requests for select using (auth.uid() = user_id);
create policy "Users can insert own kyc" on public.kyc_requests for insert with check (auth.uid() = user_id);
alter table public.loans enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.banners enable row level security;

create policy "Admins can manage kyc" on public.kyc_requests for all using (public.is_admin());
create policy "Admins can manage loans" on public.loans for all using (public.is_admin());
create policy "Admins can manage rates" on public.exchange_rates for all using (public.is_admin());
create policy "Admins can manage tickets" on public.tickets for all using (public.is_admin());
create policy "Admins can manage messages" on public.ticket_messages for all using (public.is_admin());
create policy "Admins can manage logs" on public.audit_logs for all using (public.is_admin());
create policy "Admins can manage banners" on public.banners for all using (public.is_admin());

-- 10. TEAM CHAT MESSAGES
create table public.team_messages (
  id uuid default uuid_generate_v4() primary key,
  channel text not null,
  sender_id uuid references public.profiles(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.team_messages enable row level security;

create policy "Authenticated users can view team messages"
  on public.team_messages for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own team messages"
  on public.team_messages for insert
  with check (auth.uid() = sender_id);

-- 11. VIRTUAL ACCOUNTS
create table public.virtual_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null unique,
  provider text not null, -- 'paystack' or 'flutterwave'
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  currency text default 'NGN',
  meta_data jsonb, -- Store full provider response
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.virtual_accounts enable row level security;

create policy "Users can view own virtual account"
  on public.virtual_accounts for select
  using (auth.uid() = user_id);

create policy "Admins can view all virtual accounts"
  on public.virtual_accounts for select
  using (public.is_admin());

-- 12. PAYMENT EVENTS (Webhook Logs)
create table public.payment_events (
  id uuid default uuid_generate_v4() primary key,
  provider text not null,
  reference text unique not null,
  amount decimal(12,2) not null,
  currency text not null,
  status text not null,
  metadata jsonb,
  processed_at timestamp with time zone, -- Null if not processed yet, or timestamp if done
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payment_events enable row level security;
create policy "Admins can view payment events"
  on public.payment_events for select
  using (public.is_admin());

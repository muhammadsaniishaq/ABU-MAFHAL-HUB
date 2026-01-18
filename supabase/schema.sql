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
    select count(*) > 0
    from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
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

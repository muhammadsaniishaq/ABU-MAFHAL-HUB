create table if not exists airtime_configs (
  id uuid default gen_random_uuid() primary key,
  network text not null unique,
  cost_percentage numeric(5,2) default 0, -- e.g. 3.00 for 3% discount from provider
  sell_percentage numeric(5,2) default 0, -- e.g. 2.00 for 2% discount to user (profit = 1%)
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed defaults
insert into airtime_configs (network, cost_percentage, sell_percentage)
values 
  ('MTN', 3.0, 0.0),
  ('GLO', 4.0, 0.0),
  ('AIRTEL', 3.0, 0.0),
  ('9MOBILE', 4.0, 0.0)
on conflict (network) do nothing;

alter table airtime_configs enable row level security;

-- Policies
drop policy if exists "Allow public read access" on airtime_configs;
create policy "Allow public read access" on airtime_configs for select using (true);

drop policy if exists "Allow admin update" on airtime_configs;
create policy "Allow admin update" on airtime_configs for update using (true); -- Ideally restricted to admin role

drop policy if exists "Allow admin insert" on airtime_configs;
create policy "Allow admin insert" on airtime_configs for insert with check (true);

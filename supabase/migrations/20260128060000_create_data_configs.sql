create table if not exists data_configs (
  id uuid default gen_random_uuid() primary key,
  network text not null unique, -- 'mtn', 'glo', 'airtel', '9mobile'
  markup_type text not null default 'fixed', -- 'fixed' or 'percentage'
  markup_value numeric(10,2) default 50.00, -- e.g. 50.00 Naira or 5.00 percent
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed default values
insert into data_configs (network, markup_type, markup_value)
values 
  ('mtn', 'fixed', 50.00),
  ('glo', 'fixed', 50.00),
  ('airtel', 'fixed', 50.00),
  ('9mobile', 'fixed', 50.00)
on conflict (network) do nothing;

alter table data_configs enable row level security;

-- Policies
drop policy if exists "Allow public read access" on data_configs;
create policy "Allow public read access" on data_configs for select using (true);

drop policy if exists "Allow admin update" on data_configs;
create policy "Allow admin update" on data_configs for update using (true);

drop policy if exists "Allow admin insert" on data_configs;
create policy "Allow admin insert" on data_configs for insert with check (true);

-- Allow authenticated users to insert their own virtual account
drop policy if exists "Users can create own virtual account" on public.virtual_accounts;
create policy "Users can create own virtual account"
  on public.virtual_accounts for insert
  with check (auth.uid() = user_id);

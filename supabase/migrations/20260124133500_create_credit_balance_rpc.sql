-- Create Credit Balance RPC
create or replace function credit_balance(user_id uuid, amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  new_balance numeric;
begin
  -- Update balance
  update profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id
  returning balance into new_balance;

  return new_balance;
end;
$$;

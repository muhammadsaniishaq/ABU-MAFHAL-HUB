-- Function to safely deduct balance (Atomic)
create or replace function public.deduct_balance(user_id uuid, amount numeric)
returns numeric as $$
declare
  current_bal numeric;
  new_bal numeric;
begin
  -- Lock row for update
  select balance into current_bal from public.profiles where id = user_id for update;
  
  if current_bal is null then
    current_bal := 0;
  end if;

  if current_bal < amount then
    raise exception 'Insufficient balance';
  end if;
  
  new_bal := current_bal - amount;
  
  update public.profiles set balance = new_bal where id = user_id;
  
  return new_bal;
end;
$$ language plpgsql security definer;

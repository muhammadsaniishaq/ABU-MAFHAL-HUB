-- 1. Find profile by email (Bypasses RLS safely to verify recipient info)
create or replace function public.find_profile_by_email(email_query text)
returns jsonb as $$
declare
  recipient_id uuid;
  recipient_name text;
  recipient_email text;
  recipient_avatar text;
  result jsonb;
begin
  select id, full_name, email, avatar_url into recipient_id, recipient_name, recipient_email, recipient_avatar
  from public.profiles
  where email = lower(trim(email_query));

  if recipient_id is null then
    return null;
  end if;

  result := jsonb_build_object(
    'id', recipient_id,
    'full_name', recipient_name,
    'email', recipient_email,
    'avatar_url', recipient_avatar
  );
  
  return result;
end;
$$ language plpgsql security definer;

-- 2. Execute wallet transfer (Atomically processes balances and logs transactions on the backend)
create or replace function public.execute_wallet_transfer(
  sender_id uuid,
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default ''
)
returns jsonb as $$
declare
  sender_bal decimal;
  sender_name text;
  recipient_id uuid;
  recipient_name text;
  recipient_email text;
  reference text;
  result jsonb;
begin
  -- 1. Find recipient ID and info
  if target_id is not null then
    select id, full_name, email into recipient_id, recipient_name, recipient_email
    from public.profiles
    where id = target_id;
  elsif target_email is not null then
    select id, full_name, email into recipient_id, recipient_name, recipient_email
    from public.profiles
    where email = lower(trim(target_email));
  else
    raise exception 'Either target ID or target email must be provided';
  end if;

  if recipient_id is null then
    raise exception 'Recipient user not found';
  end if;

  if recipient_id = sender_id then
    raise exception 'You cannot transfer money to yourself';
  end if;

  if amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  -- 2. Lock and check sender balance
  select balance, full_name into sender_bal, sender_name
  from public.profiles
  where id = sender_id for update;

  if sender_bal is null then
    raise exception 'Sender profile not found';
  end if;

  if sender_bal < amount then
    raise exception 'Insufficient balance. Available balance is NGN %', sender_bal;
  end if;

  -- 3. Deduct from sender
  update public.profiles
  set balance = balance - amount
  where id = sender_id;

  -- 4. Credit recipient
  update public.profiles
  set balance = balance + amount
  where id = recipient_id;

  -- 5. Create transaction reference
  reference := 'QR-' || extract(epoch from now())::text;

  -- 6. Insert transactions
  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (sender_id, 'transfer', amount, 'success', coalesce(note, 'QR Pay to ' || recipient_name), reference || '-OUT');

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (recipient_id, 'deposit', amount, 'success', 'QR Receive from ' || sender_name, reference || '-IN');

  result := jsonb_build_object(
    'success', true,
    'recipient_name', recipient_name,
    'recipient_email', recipient_email,
    'recipient_id', recipient_id
  );
  
  return result;
end;
$$ language plpgsql security definer;

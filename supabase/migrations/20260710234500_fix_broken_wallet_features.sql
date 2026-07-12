-- Secure RPC to withdraw referral earnings to main balance
CREATE OR REPLACE FUNCTION public.withdraw_referral_earnings(amount numeric)
RETURNS numeric AS $$
DECLARE
    current_ref_bal numeric;
    current_main_bal numeric;
    new_ref_bal numeric;
    new_main_bal numeric;
    uid uuid;
BEGIN
    uid := auth.uid();
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock the profile row for update
    SELECT referral_balance, balance INTO current_ref_bal, current_main_bal 
    FROM public.profiles 
    WHERE id = uid FOR UPDATE;

    IF current_ref_bal < amount THEN
        RAISE EXCEPTION 'Insufficient referral balance';
    END IF;

    IF amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    new_ref_bal := current_ref_bal - amount;
    new_main_bal := current_main_bal + amount;

    -- Update balances
    UPDATE public.profiles 
    SET referral_balance = new_ref_bal, balance = new_main_bal
    WHERE id = uid;

    -- Log transaction securely
    INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
    VALUES (uid, 'referral_withdrawal', amount, 'success', 'Withdrawal from Referral Earnings', 'REF_WD_' || extract(epoch from now())::bigint || floor(random() * 1000));

    RETURN new_main_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Create the trigger function to protect sensitive profile columns
CREATE OR REPLACE FUNCTION prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow the system service role or admins to modify anything
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- If a normal user is making the update, silently revert protected columns back to their OLD values.
    -- This prevents them from granting themselves admin access or infinite money via API payloads.
    NEW.balance := OLD.balance;
    NEW.role := OLD.role;
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.referral_balance := OLD.referral_balance;
    NEW.monthly_profit := OLD.monthly_profit;
    NEW.reward_points := OLD.reward_points;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the BEFORE UPDATE trigger to the profiles table
DROP TRIGGER IF EXISTS tr_prevent_unauthorized_profile_updates ON public.profiles;

CREATE TRIGGER tr_prevent_unauthorized_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_unauthorized_profile_updates();


-- 3. Patch the update_crypto_balance RPC
CREATE OR REPLACE FUNCTION update_crypto_balance(
    p_user_id UUID,
    p_asset VARCHAR,
    p_amount NUMERIC
) RETURNS void AS $$
BEGIN
    -- SECURE: Only allow admins or the system service_role
    if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
        raise exception 'Unauthorized: Only admins can arbitrarily update crypto balances';
    end if;

    INSERT INTO public.crypto_balances (user_id, asset, balance)
    VALUES (p_user_id, LOWER(p_asset), p_amount)
    ON CONFLICT (user_id, asset)
    DO UPDATE SET 
        balance = crypto_balances.balance + p_amount,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

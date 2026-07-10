-- Create crypto_balances table
CREATE TABLE IF NOT EXISTS public.crypto_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    asset VARCHAR(20) NOT NULL, -- e.g., 'USDT', 'BTC'
    balance NUMERIC(20, 8) DEFAULT 0.00000000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, asset)
);

-- RLS Policies
ALTER TABLE public.crypto_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crypto balances"
    ON public.crypto_balances
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role or triggers should insert/update balances, but if they want to let users via Edge Functions
-- the edge function uses service_role key, so no insert/update RLS needed for regular users.

-- Function to handle crypto balance update directly if needed
CREATE OR REPLACE FUNCTION update_crypto_balance(
    p_user_id UUID,
    p_asset VARCHAR,
    p_amount NUMERIC
) RETURNS void AS $$
BEGIN
    INSERT INTO public.crypto_balances (user_id, asset, balance)
    VALUES (p_user_id, p_asset, p_amount)
    ON CONFLICT (user_id, asset)
    DO UPDATE SET 
        balance = crypto_balances.balance + p_amount,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

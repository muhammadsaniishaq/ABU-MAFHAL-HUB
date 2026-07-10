-- Create table to store generated crypto addresses per user
CREATE TABLE IF NOT EXISTS public.crypto_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'nowpayments',
    network TEXT NOT NULL, -- e.g., 'TRC20', 'BEP20', 'ERC20'
    currency TEXT NOT NULL, -- e.g., 'usdt', 'trx', 'eth'
    address TEXT NOT NULL,
    payment_id TEXT, -- Internal reference ID from the provider if needed
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, network, currency) -- Only one active address per network/currency combo per user
);

-- Enable RLS
ALTER TABLE public.crypto_addresses ENABLE ROW LEVEL SECURITY;

-- Users can read their own addresses
CREATE POLICY "Users can view their own crypto addresses"
    ON public.crypto_addresses FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role can insert/update (done via Edge Functions)

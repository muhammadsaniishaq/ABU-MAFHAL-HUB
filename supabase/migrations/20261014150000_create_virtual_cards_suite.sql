-- Migration: 20261014150000_create_virtual_cards_suite.sql
-- Description: Comprehensive schema for Payvessel Virtual Cards & Card Transactions

-- 1. Create user_virtual_cards table
CREATE TABLE IF NOT EXISTS public.user_virtual_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    card_name TEXT DEFAULT 'ABU MAFHAL USD Card',
    card_number_masked TEXT NOT NULL,
    card_number_full TEXT,
    cvv TEXT,
    expiry_month TEXT NOT NULL,
    expiry_year TEXT NOT NULL,
    card_holder_name TEXT NOT NULL,
    currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'NGN')),
    card_type TEXT DEFAULT 'VISA' CHECK (card_type IN ('VISA', 'MASTERCARD')),
    balance NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'terminated')),
    spending_limit_monthly NUMERIC(15, 2) DEFAULT 1000.00,
    spending_limit_transaction NUMERIC(15, 2) DEFAULT 500.00,
    online_payments_enabled BOOLEAN DEFAULT TRUE,
    international_payments_enabled BOOLEAN DEFAULT TRUE,
    contactless_payments_enabled BOOLEAN DEFAULT FALSE,
    billing_address JSONB DEFAULT '{"street":"350 Fifth Avenue, Suite 4100","city":"New York","state":"NY","zip":"10118","country":"United States"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast card lookup
CREATE INDEX IF NOT EXISTS idx_user_virtual_cards_user_id ON public.user_virtual_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_virtual_cards_card_id ON public.user_virtual_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_user_virtual_cards_status ON public.user_virtual_cards(status);

-- 3. Create card_transactions table
CREATE TABLE IF NOT EXISTS public.card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.user_virtual_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_name TEXT NOT NULL,
    merchant_category TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'DECLINED')),
    type TEXT DEFAULT 'DEBIT' CHECK (type IN ('DEBIT', 'CREDIT')),
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON public.card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_user_id ON public.card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_created_at ON public.card_transactions(created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.user_virtual_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Policies for user_virtual_cards
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read their own virtual cards" ON public.user_virtual_cards;
    CREATE POLICY "Users can read their own virtual cards"
        ON public.user_virtual_cards FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert their own virtual cards" ON public.user_virtual_cards;
    CREATE POLICY "Users can insert their own virtual cards"
        ON public.user_virtual_cards FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update their own virtual cards" ON public.user_virtual_cards;
    CREATE POLICY "Users can update their own virtual cards"
        ON public.user_virtual_cards FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Service role has full access to virtual cards" ON public.user_virtual_cards;
    CREATE POLICY "Service role has full access to virtual cards"
        ON public.user_virtual_cards FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
END $$;

-- 6. Policies for card_transactions
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read their own card transactions" ON public.card_transactions;
    CREATE POLICY "Users can read their own card transactions"
        ON public.card_transactions FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert their card transactions" ON public.card_transactions;
    CREATE POLICY "Users can insert their card transactions"
        ON public.card_transactions FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Service role has full access to card transactions" ON public.card_transactions;
    CREATE POLICY "Service role has full access to card transactions"
        ON public.card_transactions FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
END $$;

-- 1. Insert Default Crypto Settings into app_settings table
-- These control the state of the toggle switches and fees in Crypto Command
INSERT INTO app_settings (key, value)
VALUES 
    ('crypto_enabled_btc', 'true'),
    ('crypto_enabled_usdt', 'true'),
    ('crypto_enabled_eth', 'false'),
    ('crypto_fee_trc20_usdt', '1.5'),
    ('crypto_fee_btc', '0.0005'),
    ('crypto_rate_btc_buy', '86500000'),
    ('crypto_rate_btc_sell', '85000000'),
    ('crypto_rate_usdt_buy', '1480'),
    ('crypto_rate_usdt_sell', '1460'),
    ('crypto_rate_eth_buy', '4500000'),
    ('crypto_rate_eth_sell', '4300000')
ON CONFLICT (key) DO NOTHING;

-- 2. Optional: If you don't have a transactions table yet for pending withdrawals, create one:
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    type VARCHAR(50) NOT NULL, -- e.g., 'crypto_withdrawal', 'airtime', 'data'
    amount DECIMAL NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Optional: Table for P2P Disputes if you want to track them
CREATE TABLE IF NOT EXISTS p2p_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES auth.users(id),
    seller_id UUID REFERENCES auth.users(id),
    amount DECIMAL NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'disputed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

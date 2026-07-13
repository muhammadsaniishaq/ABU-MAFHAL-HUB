-- 1. Insert Default Crypto Settings into app_settings table
-- These control the state of the toggle switches and fees in Crypto Command
INSERT INTO app_settings (key, value)
VALUES 
    ('crypto_enabled_btc', 'true'),
    ('crypto_enabled_usdt', 'true'),
    ('crypto_enabled_eth', 'false'),
    ('crypto_maintenance_mode', 'false'),
    ('crypto_receive_enabled', 'true'),
    ('crypto_send_enabled', 'true'),
    ('crypto_buy_enabled', 'true'),
    ('crypto_sell_enabled', 'true'),
    ('crypto_swap_enabled', 'true'),
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
    user_id UUID REFERENCES profiles(id),
    type VARCHAR(50) NOT NULL, -- e.g., 'crypto_withdrawal', 'airtime', 'data'
    amount DECIMAL NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Optional: Table for P2P Disputes if you want to track them
CREATE TABLE IF NOT EXISTS p2p_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES profiles(id),
    seller_id UUID REFERENCES profiles(id),
    amount DECIMAL NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'disputed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Trade History table
CREATE TABLE IF NOT EXISTS trade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    trade_type VARCHAR(20) NOT NULL, -- 'buy', 'sell', 'swap'
    coin VARCHAR(10) NOT NULL, -- 'BTC', 'USDT', 'ETH'
    amount DECIMAL NOT NULL,
    fiat_value DECIMAL NOT NULL,
    fee DECIMAL NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create User Wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
    user_id UUID PRIMARY KEY REFERENCES profiles(id),
    btc_balance DECIMAL DEFAULT 0,
    usdt_balance DECIMAL DEFAULT 0,
    eth_balance DECIMAL DEFAULT 0,
    fiat_balance DECIMAL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. FIX FOREIGN KEYS (Run this if you get schema cache errors or relationship errors)
-- This drops any existing foreign key to auth.users and points them to profiles.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_buyer_id_fkey;
ALTER TABLE p2p_orders ADD CONSTRAINT p2p_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_seller_id_fkey;
ALTER TABLE p2p_orders ADD CONSTRAINT p2p_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE trade_history DROP CONSTRAINT IF EXISTS trade_history_user_id_fkey;
ALTER TABLE trade_history ADD CONSTRAINT trade_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_wallets DROP CONSTRAINT IF EXISTS user_wallets_user_id_fkey;
ALTER TABLE user_wallets ADD CONSTRAINT user_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- IMPORTANT: After running this, reload your app or call supabase schema cache reload.

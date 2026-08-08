-- SQL Migration: Create recharge_pins table and RLS policies
CREATE TABLE IF NOT EXISTS recharge_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id TEXT,
    network TEXT NOT NULL,
    denomination TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1,
    business_name TEXT,
    pins JSONB NOT NULL,
    load_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE recharge_pins ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own recharge pins" ON recharge_pins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow service role full access" ON recharge_pins FOR ALL USING (true);

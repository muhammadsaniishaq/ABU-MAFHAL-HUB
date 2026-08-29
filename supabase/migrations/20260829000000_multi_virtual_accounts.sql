-- Migration: Enable Multiple Virtual Accounts per User (e.g. 9PSB & PalmPay)

-- 1. Drop existing unique constraint on user_id if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'virtual_accounts_user_id_key'
    ) THEN
        ALTER TABLE public.virtual_accounts DROP CONSTRAINT virtual_accounts_user_id_key;
    END IF;
END $$;

-- 2. Ensure account_number is unique
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'virtual_accounts_account_number_key'
    ) THEN
        ALTER TABLE public.virtual_accounts ADD CONSTRAINT virtual_accounts_account_number_key UNIQUE (account_number);
    END IF;
END $$;

-- 3. Create index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_user_id ON public.virtual_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_bank_user ON public.virtual_accounts(user_id, bank_name);

-- 4. Ensure RLS policies are up to date
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own virtual account" ON public.virtual_accounts;
DROP POLICY IF EXISTS "Users can view own virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Users can view own virtual accounts"
  ON public.virtual_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own virtual account" ON public.virtual_accounts;
DROP POLICY IF EXISTS "Users can insert own virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Users can insert own virtual accounts"
  ON public.virtual_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own virtual account" ON public.virtual_accounts;
CREATE POLICY "Users can update own virtual accounts"
  ON public.virtual_accounts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Admins can view all virtual accounts"
  ON public.virtual_accounts FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Admins can manage all virtual accounts"
  ON public.virtual_accounts FOR ALL
  USING (public.is_admin());

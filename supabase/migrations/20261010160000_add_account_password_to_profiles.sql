-- Add account_password and temp_password columns to profiles for Super Admin credential authority
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_password text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS temp_password text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plain_password text;

-- Add index if helpful
CREATE INDEX IF NOT EXISTS idx_profiles_account_password ON public.profiles(account_password) WHERE account_password IS NOT NULL;

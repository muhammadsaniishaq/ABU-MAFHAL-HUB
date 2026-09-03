-- Migration: Fix is_admin() helper and virtual_accounts RLS policies for managers/admins

-- 1. Upgrade public.is_admin() to recognize admins via profiles.role AND known admin emails
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    COALESCE(
      (SELECT (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin') FROM auth.users WHERE id = auth.uid()),
      false
    )
    OR
    COALESCE(
      (SELECT role IN ('admin', 'super_admin') FROM public.profiles WHERE id = auth.uid()),
      false
    )
    OR
    COALESCE(
      (
        SELECT 
          lower(email) IN ('sale.abumafhal@gmail.com', 'abumafhal@gmail.com') 
          OR lower(email) LIKE '%@abumafhal.com' 
          OR lower(email) LIKE '%@abumafhal.com.ng'
        FROM auth.users 
        WHERE id = auth.uid()
      ),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure virtual_accounts table has proper admin RLS policies
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Admins can view all virtual accounts"
  ON public.virtual_accounts FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Admins can manage all virtual accounts"
  ON public.virtual_accounts FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own virtual accounts" ON public.virtual_accounts;
CREATE POLICY "Users can view own virtual accounts"
  ON public.virtual_accounts FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- 3. Ensure system_secrets can be viewed and managed by all admins
DROP POLICY IF EXISTS "Admins can manage system secrets" ON public.system_secrets;
CREATE POLICY "Admins can manage system secrets" 
  ON public.system_secrets FOR ALL 
  USING (public.is_admin());

-- 4. Create an admin RPC to batch-assign virtual accounts directly if needed
CREATE OR REPLACE FUNCTION public.admin_assign_virtual_account(
  p_user_id uuid,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_provider text DEFAULT 'payvessel'
)
RETURNS jsonb AS $$
DECLARE
  v_inserted record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can execute this function';
  END IF;

  INSERT INTO public.virtual_accounts (
    user_id,
    bank_name,
    account_number,
    account_name,
    provider,
    currency,
    created_at
  )
  VALUES (
    p_user_id,
    p_bank_name,
    p_account_number,
    p_account_name,
    p_provider,
    'NGN',
    now()
  )
  ON CONFLICT (account_number) 
  DO UPDATE SET
    bank_name = EXCLUDED.bank_name,
    account_name = EXCLUDED.account_name,
    provider = EXCLUDED.provider
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'status', 'success',
    'id', v_inserted.id,
    'user_id', v_inserted.user_id,
    'account_number', v_inserted.account_number,
    'bank_name', v_inserted.bank_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Ensure api_vendor column exists in data_plans table
ALTER TABLE public.data_plans ADD COLUMN IF NOT EXISTS api_vendor VARCHAR(50) DEFAULT 'clubkonnect';

-- 2. Ensure vtu_vendor setting exists in app_settings table
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS vtu_vendor VARCHAR(50) DEFAULT 'clubkonnect';

-- 3. Create index on network and api_vendor for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_plans_network_vendor ON public.data_plans(network, api_vendor);

-- 4. Enable RLS on app_settings and grant permissions
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_settings" ON public.app_settings;
CREATE POLICY "Allow public read app_settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update app_settings" ON public.app_settings;
CREATE POLICY "Allow authenticated insert/update app_settings" ON public.app_settings FOR ALL USING (true);

GRANT ALL ON TABLE public.app_settings TO postgres, service_role, anon, authenticated;

-- 5. Enable RLS on data_plans and grant permissions
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read data_plans" ON public.data_plans;
CREATE POLICY "Allow public read data_plans" ON public.data_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update data_plans" ON public.data_plans;
CREATE POLICY "Allow authenticated insert/update data_plans" ON public.data_plans FOR ALL USING (true);

GRANT ALL ON TABLE public.data_plans TO postgres, service_role, anon, authenticated;

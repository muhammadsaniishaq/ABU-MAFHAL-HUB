-- 1. Ensure RLS allows authenticated users / admins to manage system_secrets
CREATE POLICY "Allow authenticated admins system_secrets" 
ON public.system_secrets FOR ALL 
USING (true);

-- 2. Insert / Update Zoho OAuth API Credentials into system_secrets table
INSERT INTO public.system_secrets (key, value, description)
VALUES 
  ('ZOHO_ORG_ID', '911972993', 'Zoho Mail Organization ID (ZOID)'),
  ('ZOHO_CLIENT_ID', '1000.XGFAO3DIJ6T334FTCGSB9DL0DIUILH', 'Zoho OAuth API Client ID'),
  ('ZOHO_CLIENT_SECRET', '03c230ab9c0dcdfb89c8c2bd19377f9d8c45e97946', 'Zoho OAuth API Client Secret'),
  ('ZOHO_REFRESH_TOKEN', '1000.d1eaf7983dc0df2b7c18690aff46284e.b147c42954cf75e714d87bacd3f4401c', 'Zoho OAuth API Permanent Refresh Token')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Comprehensive SQL Migration for BilalSadaSub & Vital Network Data Plans

-- 1. Normalize network names to lowercase
UPDATE public.data_plans SET network = 'vitel' WHERE LOWER(network) IN ('vital', 'vitel');
UPDATE public.data_plans SET network = 'mtn' WHERE LOWER(network) = 'mtn';
UPDATE public.data_plans SET network = 'glo' WHERE LOWER(network) = 'glo';
UPDATE public.data_plans SET network = 'airtel' WHERE LOWER(network) = 'airtel';
UPDATE public.data_plans SET network = '9mobile' WHERE LOWER(network) IN ('9mobile', 'etisalat', 't2');

-- 2. Ensure all data plans have is_active set to true
UPDATE public.data_plans SET is_active = true WHERE is_active IS NULL OR is_active = false;

-- 3. Seed/Upsert complete BilalSadaSub data plans for all 5 networks (MTN, GLO, AIRTEL, 9MOBILE, VITAL)
INSERT INTO public.data_plans (plan_id, network, name, volume, validity, cost_price, selling_price, plan_type, is_active, api_vendor)
VALUES
  -- VITAL Network Plans (BilalSadaSub)
  ('BILAL-VITEL-500MB', 'vitel', 'VITAL 500MB Direct [BILAL]', '500MB', '30 Days', 120, 140, 'DIRECT', true, 'bilalsadasub'),
  ('BILAL-VITEL-1GB', 'vitel', 'VITAL 1GB Direct [BILAL]', '1GB', '30 Days', 230, 260, 'DIRECT', true, 'bilalsadasub'),
  ('BILAL-VITEL-2GB', 'vitel', 'VITAL 2GB Direct [BILAL]', '2GB', '30 Days', 460, 520, 'DIRECT', true, 'bilalsadasub'),
  ('BILAL-VITEL-3GB', 'vitel', 'VITAL 3GB Direct [BILAL]', '3GB', '30 Days', 690, 780, 'DIRECT', true, 'bilalsadasub'),
  ('BILAL-VITEL-5GB', 'vitel', 'VITAL 5GB Direct [BILAL]', '5GB', '30 Days', 1150, 1300, 'DIRECT', true, 'bilalsadasub'),
  ('BILAL-VITEL-10GB', 'vitel', 'VITAL 10GB Direct [BILAL]', '10GB', '30 Days', 2300, 2550, 'DIRECT', true, 'bilalsadasub'),

  -- MTN Network Plans (BilalSadaSub)
  ('BILAL-MTN-500MB-SME', 'mtn', 'MTN 500MB SME [BILAL]', '500MB', '30 Days', 125, 145, 'SME', true, 'bilalsadasub'),
  ('BILAL-MTN-1GB-SME', 'mtn', 'MTN 1GB SME [BILAL]', '1GB', '30 Days', 245, 275, 'SME', true, 'bilalsadasub'),
  ('BILAL-MTN-2GB-SME', 'mtn', 'MTN 2GB SME [BILAL]', '2GB', '30 Days', 490, 550, 'SME', true, 'bilalsadasub'),
  ('BILAL-MTN-3GB-SME', 'mtn', 'MTN 3GB SME [BILAL]', '3GB', '30 Days', 735, 825, 'SME', true, 'bilalsadasub'),
  ('BILAL-MTN-5GB-SME', 'mtn', 'MTN 5GB SME [BILAL]', '5GB', '30 Days', 1225, 1375, 'SME', true, 'bilalsadasub'),
  ('BILAL-MTN-10GB-SME', 'mtn', 'MTN 10GB SME [BILAL]', '10GB', '30 Days', 2450, 2750, 'SME', true, 'bilalsadasub'),
  ('BILAL-MTN-1GB-CG', 'mtn', 'MTN 1GB Corporate Gifting [BILAL]', '1GB', '30 Days', 255, 285, 'CG', true, 'bilalsadasub'),
  ('BILAL-MTN-2GB-CG', 'mtn', 'MTN 2GB Corporate Gifting [BILAL]', '2GB', '30 Days', 510, 570, 'CG', true, 'bilalsadasub'),
  ('BILAL-MTN-5GB-CG', 'mtn', 'MTN 5GB Corporate Gifting [BILAL]', '5GB', '30 Days', 1275, 1425, 'CG', true, 'bilalsadasub'),

  -- GLO Network Plans (BilalSadaSub)
  ('BILAL-GLO-1GB-CG', 'glo', 'Glo 1GB Corporate Gifting [BILAL]', '1GB', '30 Days', 235, 265, 'CG', true, 'bilalsadasub'),
  ('BILAL-GLO-2GB-CG', 'glo', 'Glo 2GB Corporate Gifting [BILAL]', '2GB', '30 Days', 470, 530, 'CG', true, 'bilalsadasub'),
  ('BILAL-GLO-3GB-CG', 'glo', 'Glo 3GB Corporate Gifting [BILAL]', '3GB', '30 Days', 705, 795, 'CG', true, 'bilalsadasub'),
  ('BILAL-GLO-5GB-CG', 'glo', 'Glo 5GB Corporate Gifting [BILAL]', '5GB', '30 Days', 1175, 1325, 'CG', true, 'bilalsadasub'),
  ('BILAL-GLO-10GB-CG', 'glo', 'Glo 10GB Corporate Gifting [BILAL]', '10GB', '30 Days', 2350, 2650, 'CG', true, 'bilalsadasub'),

  -- AIRTEL Network Plans (BilalSadaSub)
  ('BILAL-AIRTEL-1GB-CG', 'airtel', 'Airtel 1GB Corporate Gifting [BILAL]', '1GB', '30 Days', 240, 270, 'CG', true, 'bilalsadasub'),
  ('BILAL-AIRTEL-2GB-CG', 'airtel', 'Airtel 2GB Corporate Gifting [BILAL]', '2GB', '30 Days', 480, 540, 'CG', true, 'bilalsadasub'),
  ('BILAL-AIRTEL-5GB-CG', 'airtel', 'Airtel 5GB Corporate Gifting [BILAL]', '5GB', '30 Days', 1200, 1350, 'CG', true, 'bilalsadasub'),
  ('BILAL-AIRTEL-10GB-CG', 'airtel', 'Airtel 10GB Corporate Gifting [BILAL]', '10GB', '30 Days', 2400, 2700, 'CG', true, 'bilalsadasub'),

  -- 9MOBILE Network Plans (BilalSadaSub)
  ('BILAL-9MOBILE-1GB-CG', '9mobile', '9mobile 1GB Corporate Gifting [BILAL]', '1GB', '30 Days', 220, 250, 'CG', true, 'bilalsadasub'),
  ('BILAL-9MOBILE-2GB-CG', '9mobile', '9mobile 2GB Corporate Gifting [BILAL]', '2GB', '30 Days', 440, 500, 'CG', true, 'bilalsadasub'),
  ('BILAL-9MOBILE-5GB-CG', '9mobile', '9mobile 5GB Corporate Gifting [BILAL]', '5GB', '30 Days', 1100, 1250, 'CG', true, 'bilalsadasub')
ON CONFLICT (plan_id) DO UPDATE SET
  network = EXCLUDED.network,
  name = EXCLUDED.name,
  selling_price = EXCLUDED.selling_price,
  is_active = true,
  api_vendor = 'bilalsadasub';

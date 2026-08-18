-- Migration to seed Vital (Vitel) network data plans supplied via BilalSadaSub API
INSERT INTO public.data_plans (plan_id, network, name, volume, validity, cost_price, selling_price, plan_type, is_active, api_vendor)
VALUES 
  ('VITEL-500MB', 'vitel', 'VITAL 500MB Direct', '500MB', '30 Days', 120, 140, 'DIRECT', true, 'bilalsadasub'),
  ('VITEL-1GB', 'vitel', 'VITAL 1GB Direct', '1GB', '30 Days', 230, 260, 'DIRECT', true, 'bilalsadasub'),
  ('VITEL-2GB', 'vitel', 'VITAL 2GB Direct', '2GB', '30 Days', 460, 520, 'DIRECT', true, 'bilalsadasub'),
  ('VITEL-3GB', 'vitel', 'VITAL 3GB Direct', '3GB', '30 Days', 690, 780, 'DIRECT', true, 'bilalsadasub'),
  ('VITEL-5GB', 'vitel', 'VITAL 5GB Direct', '5GB', '30 Days', 1150, 1300, 'DIRECT', true, 'bilalsadasub'),
  ('VITEL-10GB', 'vitel', 'VITAL 10GB Direct', '10GB', '30 Days', 2300, 2550, 'DIRECT', true, 'bilalsadasub')
ON CONFLICT (plan_id) DO UPDATE SET 
  network = EXCLUDED.network,
  name = EXCLUDED.name,
  selling_price = EXCLUDED.selling_price,
  is_active = true,
  api_vendor = 'bilalsadasub';

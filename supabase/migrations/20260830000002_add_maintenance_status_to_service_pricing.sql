-- Migration: Add status and maintenance control columns to service_pricing and initialize app_settings
-- Date: 2026-08-30

-- 1. Add status and maintenance_msg columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_pricing' AND column_name = 'status') THEN
        ALTER TABLE public.service_pricing ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_pricing' AND column_name = 'maintenance_msg') THEN
        ALTER TABLE public.service_pricing ADD COLUMN maintenance_msg TEXT;
    END IF;
END $$;

-- 2. Seed default active status for all NIN and BVN services
UPDATE public.service_pricing 
SET status = 'active' 
WHERE status IS NULL;

-- 3. Initialize Global Identity Settings in app_settings
INSERT INTO public.app_settings (key, value, updated_at) VALUES
('bvn_global_status', 'active', now()),
('nin_global_status', 'active', now()),
('bvn_global_maintenance_msg', 'BVN verification services are currently undergoing routine core server maintenance. Services will resume shortly.', now()),
('nin_global_maintenance_msg', 'NIMC portal infrastructure is currently undergoing scheduled optimization. Services will resume shortly.', now())
ON CONFLICT (key) DO NOTHING;

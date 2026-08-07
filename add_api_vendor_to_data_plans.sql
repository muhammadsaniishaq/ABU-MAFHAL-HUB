-- Ensure api_vendor column exists in data_plans table
ALTER TABLE public.data_plans ADD COLUMN IF NOT EXISTS api_vendor VARCHAR(50) DEFAULT 'clubkonnect';

-- Ensure vtu_vendor setting exists in app_settings table
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS vtu_vendor VARCHAR(50) DEFAULT 'clubkonnect';

-- Create index on network and api_vendor for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_plans_network_vendor ON public.data_plans(network, api_vendor);

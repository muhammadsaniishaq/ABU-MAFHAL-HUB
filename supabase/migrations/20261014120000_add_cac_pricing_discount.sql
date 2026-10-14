-- Add original_price and discount fields to cac_pricing
ALTER TABLE public.cac_pricing ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE public.cac_pricing ADD COLUMN IF NOT EXISTS discount_label TEXT DEFAULT NULL;

-- Migration to populate and accurately update plan_type column for all data plans
ALTER TABLE public.data_plans ADD COLUMN IF NOT EXISTS plan_type TEXT;

-- Update plan_type based on keywords in plan name
UPDATE public.data_plans
SET plan_type = CASE
    WHEN LOWER(name) LIKE '%corporate%' OR LOWER(name) LIKE '%cg%' OR LOWER(name) LIKE '%c-g%' THEN 'CG'
    WHEN LOWER(name) LIKE '%gifting%' OR LOWER(name) LIKE '%gift%' THEN 'GIFTING'
    WHEN LOWER(name) LIKE '%promo%' THEN 'PROMO'
    WHEN LOWER(name) LIKE '%mega%' THEN 'MEGA'
    WHEN LOWER(name) LIKE '%night%' THEN 'NIGHT'
    WHEN LOWER(name) LIKE '%direct%' THEN 'DIRECT'
    WHEN LOWER(name) LIKE '%coupon%' THEN 'COUPON'
    WHEN LOWER(name) LIKE '%sme%' OR LOWER(name) LIKE '%s-m-e%' THEN 'SME'
    ELSE 'DIRECT'
END;

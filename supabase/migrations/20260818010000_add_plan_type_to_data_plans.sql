-- Migration: Add plan_type column to public.data_plans table
ALTER TABLE public.data_plans ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'SME';

-- Backfill default plan_type based on plan name if empty
UPDATE public.data_plans 
SET plan_type = CASE
    WHEN LOWER(name) LIKE '%corporate%' OR LOWER(name) LIKE '%cg%' THEN 'CG'
    WHEN LOWER(name) LIKE '%gifting%' OR LOWER(name) LIKE '%direct%' THEN 'Gifting'
    WHEN LOWER(name) LIKE '%sme%' THEN 'SME'
    ELSE 'SME'
END
WHERE plan_type IS NULL OR plan_type = '';

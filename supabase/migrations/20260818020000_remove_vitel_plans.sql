-- Ensure Vital / Vitel network plans are normalized and supported
UPDATE public.data_plans 
SET network = 'vitel' 
WHERE LOWER(network) IN ('vital', 'vitel');

-- Migration to remove non-existent Vital / Vitel Data Plans and networks from database
DELETE FROM public.data_plans 
WHERE LOWER(network) IN ('vitel', 'vital') 
   OR LOWER(name) LIKE '%vital%' 
   OR LOWER(name) LIKE '%vitel%';

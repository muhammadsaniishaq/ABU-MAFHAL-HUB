-- 1. Remove old/obsolete BVN pricing entries
DELETE FROM public.service_pricing 
WHERE id IN ('bvn_validate', 'bvn_slip', 'bvn_modify');

-- 2. Insert new screenshot-matching BVN pricing defaults
INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price) VALUES
('bvn_basic', 'bvn', 'Basic Details', 150, 0),
('bvn_advanced', 'bvn', 'Advanced Details', 200, 0),
('bvn_card', 'bvn', 'BVN Card Verification', 250, 0)
ON CONFLICT (id) DO UPDATE SET
  service_category = EXCLUDED.service_category,
  name = EXCLUDED.name,
  cost_price = EXCLUDED.cost_price,
  markup_price = EXCLUDED.markup_price;

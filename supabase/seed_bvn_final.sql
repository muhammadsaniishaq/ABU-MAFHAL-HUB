-- Remove all old BVN pricing entries
DELETE FROM public.service_pricing 
WHERE service_category = 'bvn';

-- Insert the 5 correct BVN pricing options matching the web screenshots
INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price) VALUES
('bvn_num_basic', 'bvn', 'BVN Number - Basic', 200, 0),
('bvn_num_advanced', 'bvn', 'BVN Number - Advanced', 250, 0),
('bvn_phone_basic', 'bvn', 'Phone Number - Basic', 250, 0),
('bvn_phone_advanced', 'bvn', 'Phone Number - Advanced', 300, 0),
('bvn_card', 'bvn', 'BVN Card Layout', 250, 0)
ON CONFLICT (id) DO UPDATE SET
  service_category = EXCLUDED.service_category,
  name = EXCLUDED.name,
  cost_price = EXCLUDED.cost_price,
  markup_price = EXCLUDED.markup_price;

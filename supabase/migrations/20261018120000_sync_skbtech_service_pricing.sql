-- Migration: Sync SKBTECH official service pricing
-- Sets exact wholesale cost prices and reasonable default retail selling prices

INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price, selling_price, status) VALUES
-- NIN Services
('nin_premium', 'nin', 'NIN Premium Slip (HD Colour)', 120, 80, 200, 'active'),
('nin_standard', 'nin', 'NIN Standard Slip', 120, 60, 180, 'active'),
('nin_regular', 'nin', 'NIN Regular Slip', 120, 60, 180, 'active'),
('nin_phone', 'nin', 'NIN Lookup by Phone', 120, 80, 200, 'active'),
('nin_demographic', 'nin', 'NIN Demographic Lookup', 120, 80, 200, 'active'),
('nin_validation', 'validation', 'NIN Validation Service', 700, 300, 1000, 'active'),
('val_bypass_nin', 'validation', 'NIN Validation (Bypass)', 700, 300, 1000, 'active'),
('ipe_clearance', 'nin', 'IPE Clearance', 500, 200, 700, 'active'),
('pers_status', 'nin', 'NIN Personalization Tracking', 150, 100, 250, 'active'),
('nin_personalization', 'nin', 'NIN Personalization Submission', 150, 100, 250, 'active'),
('nin_mod_name', 'nin', 'NIN Modification: Name', 7300, 1200, 8500, 'active'),
('nin_mod_phone', 'nin', 'NIN Modification: Phone', 7300, 1200, 8500, 'active'),
('nin_mod_address', 'nin', 'NIN Modification: Address', 7300, 1200, 8500, 'active'),
('nin_mod_dob', 'nin', 'NIN Modification: DOB (NPC Attestation)', 37500, 2500, 40000, 'active'),
('nin_modification', 'nin', 'NIN Modification General', 7300, 1200, 8500, 'active'),

-- BVN Services
('bvn_num_advanced', 'bvn', 'BVN Verification (Standard)', 100, 100, 200, 'active'),
('bvn_card', 'bvn', 'BVN Card / Record', 100, 100, 200, 'active'),
('bvn_premium_slip', 'bvn', 'BVN Premium Slip', 100, 100, 200, 'active'),
('bvn_retrieval', 'bvn', 'BVN Retrieval by Phone', 800, 400, 1200, 'active'),
('bvn_phone_basic', 'bvn', 'BVN Retrieval by Phone (Standard)', 800, 400, 1200, 'active'),
('bvn_central_risk', 'bvn', 'BVN Central Risk CRM Retrieval', 700, 300, 1000, 'active'),
('bvn_mod_name', 'bvn', 'BVN Modification: Name', 6000, 1000, 7000, 'active'),
('bvn_mod_dob', 'bvn', 'BVN Modification: DOB', 6000, 1000, 7000, 'active'),
('bvn_mod_phone', 'bvn', 'BVN Modification: Phone', 6000, 1000, 7000, 'active'),
('bvn_mod_address', 'bvn', 'BVN Modification: Address', 6000, 1000, 7000, 'active'),
('bvn_modification', 'bvn', 'BVN Modification General', 6000, 1000, 7000, 'active')

ON CONFLICT (id) DO UPDATE SET
  cost_price = EXCLUDED.cost_price,
  markup_price = EXCLUDED.markup_price,
  selling_price = EXCLUDED.selling_price,
  status = EXCLUDED.status;

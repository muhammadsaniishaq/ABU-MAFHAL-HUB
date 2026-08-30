-- Migration: Comprehensive AgentHub BVN Pricing Catalogue with Base Cost & Markup Margins
-- Date: 2026-08-30

INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price, updated_at) VALUES
-- 1. BVN Modifications (Codes 620-626)
('bvn_mod_dob', 'bvn', 'BVN Mod: DOB', 5000, 1000, now()),
('bvn_mod_dob_phone', 'bvn', 'BVN Mod: DOB & Phone', 7000, 1500, now()),
('bvn_mod_name', 'bvn', 'BVN Mod: Name', 5000, 1000, now()),
('bvn_mod_name_dob', 'bvn', 'BVN Mod: Name & DOB', 7000, 1500, now()),
('bvn_mod_name_phone', 'bvn', 'BVN Mod: Name & Phone', 7000, 1500, now()),
('bvn_mod_phone', 'bvn', 'BVN Mod: Phone', 5000, 1000, now()),
('bvn_modification', 'bvn', 'BVN Modification Request', 5000, 1000, now()),

-- 2. BVN Slips & Retrievals
('bvn_premium_slip', 'bvn', 'BVN Premium Slip', 150, 100, now()),
('bvn_retrieval_crm', 'bvn', 'BVN Retrieval: CRM', 900, 300, now()),
('bvn_retrieval_phone', 'bvn', 'BVN Retrieval: Phone', 900, 300, now()),
('bvn_phone_basic', 'bvn', 'BVN Phone Retrieval', 900, 300, now()),

-- 3. BVN Verification & Core Identity
('bvn_num_advanced', 'bvn', 'BVN Full Verification', 150, 100, now()),
('bvn_verification', 'bvn', 'BVN Verification', 150, 100, now()),
('vnin_to_nibss', 'bvn', 'VNIN to NIBSS Integration', 500, 300, now()),
('bvn_enrollment', 'bvn', 'BVN User Enrollment', 1500, 500, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  service_category = EXCLUDED.service_category,
  cost_price = EXCLUDED.cost_price,
  markup_price = EXCLUDED.markup_price,
  updated_at = now();

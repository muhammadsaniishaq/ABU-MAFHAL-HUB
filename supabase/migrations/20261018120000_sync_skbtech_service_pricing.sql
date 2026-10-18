-- Migration: Sync SKBTECH official service pricing
-- Columns: id, service_category, name, cost_price, markup_price, updated_at

-- Ensure status column exists if not already present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_pricing' AND column_name = 'status') THEN
        ALTER TABLE public.service_pricing ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    END IF;
END $$;

INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price, updated_at) VALUES
-- NIN Services
('nin_premium', 'nin', 'NIN Premium Slip (HD Colour)', 120, 80, now()),
('nin_standard', 'nin', 'NIN Standard Slip', 120, 60, now()),
('nin_regular', 'nin', 'NIN Regular Slip', 120, 60, now()),
('nin_phone', 'nin', 'NIN Lookup by Phone', 120, 80, now()),
('nin_demographic', 'nin', 'NIN Demographic Lookup', 120, 80, now()),
('nin_validation', 'validation', 'NIN Validation Service', 700, 300, now()),
('val_bypass_nin', 'validation', 'NIN Validation (Bypass)', 700, 300, now()),
('ipe_clearance', 'nin', 'IPE Clearance', 500, 200, now()),
('pers_status', 'nin', 'NIN Personalization Tracking', 150, 100, now()),
('nin_personalization', 'nin', 'NIN Personalization Submission', 150, 100, now()),
('nin_mod_name', 'nin', 'NIN Modification: Name', 7300, 1200, now()),
('nin_mod_phone', 'nin', 'NIN Modification: Phone', 7300, 1200, now()),
('nin_mod_address', 'nin', 'NIN Modification: Address', 7300, 1200, now()),
('nin_mod_dob', 'nin', 'NIN Modification: DOB (NPC Attestation)', 37500, 2500, now()),
('nin_modification', 'nin', 'NIN Modification General', 7300, 1200, now()),

-- BVN Services
('bvn_num_advanced', 'bvn', 'BVN Verification (Standard)', 100, 100, now()),
('bvn_card', 'bvn', 'BVN Card / Record', 100, 100, now()),
('bvn_premium_slip', 'bvn', 'BVN Premium Slip', 100, 100, now()),
('bvn_retrieval', 'bvn', 'BVN Retrieval by Phone', 800, 400, now()),
('bvn_phone_basic', 'bvn', 'BVN Retrieval by Phone (Standard)', 800, 400, now()),
('bvn_central_risk', 'bvn', 'BVN Central Risk CRM Retrieval', 700, 300, now()),
('bvn_mod_name', 'bvn', 'BVN Modification: Name', 6000, 1000, now()),
('bvn_mod_dob', 'bvn', 'BVN Modification: DOB', 6000, 1000, now()),
('bvn_mod_phone', 'bvn', 'BVN Modification: Phone', 6000, 1000, now()),
('bvn_mod_address', 'bvn', 'BVN Modification: Address', 6000, 1000, now()),
('bvn_modification', 'bvn', 'BVN Modification General', 6000, 1000, now())

ON CONFLICT (id) DO UPDATE SET
  service_category = EXCLUDED.service_category,
  name = EXCLUDED.name,
  cost_price = EXCLUDED.cost_price,
  markup_price = EXCLUDED.markup_price,
  updated_at = now();

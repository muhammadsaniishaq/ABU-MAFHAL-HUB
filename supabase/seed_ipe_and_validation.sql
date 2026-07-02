-- Fix service_pricing RLS policies to allow authenticated inserts/updates
DROP POLICY IF EXISTS "Allow authenticated users to manage service_pricing" ON public.service_pricing;

CREATE POLICY "Allow authenticated users to manage service_pricing" 
ON public.service_pricing FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Insert IPE & Validation pricing defaults
INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price) VALUES
('ipe_inprocessing', 'ipe', 'InProcessing Error', 700, 0),
('ipe_still_processed', 'ipe', 'Still Being Processed', 700, 0),
('ipe_new_enrollment', 'ipe', 'New Enrollment For Tracking ID', 700, 0),
('ipe_invalid_tracking', 'ipe', 'Invalid Tracking ID', 700, 0),
('ipe_slip_none', 'ipe', 'No Slip (Clearance)', 0, 0),
('ipe_slip_regular', 'ipe', 'Regular Slip (Clearance)', 0, 0),
('ipe_slip_premium', 'ipe', 'Premium Slip (Clearance)', 150, 0),
('val_no_record', 'validation', 'No Record Found', 900, 0),
('val_update_record', 'validation', 'Update Record', 900, 0),
('val_validate_modification', 'validation', 'Validate Modification', 900, 0),
('val_vnin_validation', 'validation', 'V-NIN Validation', 900, 0),
('val_photo_error', 'validation', 'Photograph Error', 900, 0),
('val_bypass_nin', 'validation', 'Bypass NIN', 900, 0),
('val_slip_none', 'validation', 'No Slip (Validation)', 0, 0),
('val_slip_premium', 'validation', 'Premium Slip (Validation)', 150, 0)
ON CONFLICT (id) DO UPDATE SET
  service_category = EXCLUDED.service_category,
  name = EXCLUDED.name;

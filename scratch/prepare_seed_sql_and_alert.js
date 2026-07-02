const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '../supabase/seed_ipe_and_validation.sql');
const adminPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');

// 1. Create SQL seed file
const sqlContent = `-- Fix service_pricing RLS policies to allow authenticated inserts/updates
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
`;

fs.writeFileSync(sqlPath, sqlContent, 'utf8');
console.log('Successfully created supabase/seed_ipe_and_validation.sql!');

// 2. Modify app/manage/nin-pricing.tsx to add error logging for inserts
if (fs.existsSync(adminPath)) {
    let content = fs.readFileSync(adminPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // Update IPE seeder loop
    content = content.replace(
        `            for (const item of ipePricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }`,
        `            for (const item of ipePricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    const { error: insErr } = await supabase.from('service_pricing').insert(item);
                    if (insErr) {
                        console.warn('Failed to seed IPE item ' + item.id + ':', insErr.message);
                    }
                }
            }`
    );

    // Update Validation seeder loop
    content = content.replace(
        `            for (const item of valPricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }`,
        `            for (const item of valPricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    const { error: insErr } = await supabase.from('service_pricing').insert(item);
                    if (insErr) {
                        console.warn('Failed to seed Validation item ' + item.id + ':', insErr.message);
                        Alert.alert('Database Seeding Error', 'Failed to seed ' + item.name + ': ' + insErr.message + '\\n\\nZaka iya gudanar da SQL script din da na shirya a Supabase dashboard dinka.');
                    }
                }
            }`
    );

    fs.writeFileSync(adminPath, content, 'utf8');
    console.log('Successfully added error diagnostic alerts to app/manage/nin-pricing.tsx!');
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts[0] === 'SUPABASE_URL' || parts[0] === 'EXPO_PUBLIC_SUPABASE_URL') {
            supabaseUrl = parts[1].trim().replace(/['"]/g, '');
        }
        if (parts[0] === 'SUPABASE_SERVICE_ROLE_KEY' || parts[0] === 'EXPO_PUBLIC_SUPABASE_ANON_KEY') {
            supabaseKey = parts[1].trim().replace(/['"]/g, '');
        }
    });
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Credentials missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ipePricingData = [
    { id: 'ipe_inprocessing', service_category: 'ipe', name: 'InProcessing Error', cost_price: 700, markup_price: 0 },
    { id: 'ipe_still_processed', service_category: 'ipe', name: 'Still Being Processed', cost_price: 700, markup_price: 0 },
    { id: 'ipe_new_enrollment', service_category: 'ipe', name: 'New Enrollment For Tracking ID', cost_price: 700, markup_price: 0 },
    { id: 'ipe_invalid_tracking', service_category: 'ipe', name: 'Invalid Tracking ID', cost_price: 700, markup_price: 0 },
    { id: 'ipe_slip_regular', service_category: 'ipe', name: 'Regular Slip (Clearance)', cost_price: 0, markup_price: 0 },
    { id: 'ipe_slip_premium', service_category: 'ipe', name: 'Premium Slip (Clearance)', cost_price: 150, markup_price: 0 }
];

async function run() {
    console.log('Inserting IPE Clearance Pricing entries...');
    for (const item of ipePricingData) {
        const { data: existing } = await supabase.from('service_pricing').select('id').eq('id', item.id).maybeSingle();
        if (existing) {
            console.log(`Entry ${item.id} already exists. Skipping.`);
            continue;
        }
        const { error } = await supabase.from('service_pricing').insert({
            ...item,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (error) {
            console.error(`Failed to insert ${item.id}:`, error);
        } else {
            console.log(`Inserted ${item.id} successfully.`);
        }
    }
    console.log('Completed successfully!');
}
run();

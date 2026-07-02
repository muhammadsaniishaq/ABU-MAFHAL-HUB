const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Clearing old BVN categories...');
    const { error: deleteErr } = await supabase
        .from('service_pricing')
        .delete()
        .eq('service_category', 'bvn');

    if (deleteErr) {
        console.error('Delete failed:', deleteErr);
    } else {
        console.log('Successfully cleared old BVN categories.');
    }

    const bvnPricingDefaults = [
        { id: 'bvn_num_basic', service_category: 'bvn', name: 'BVN Number - Basic', cost_price: 200, markup_price: 0 },
        { id: 'bvn_num_advanced', service_category: 'bvn', name: 'BVN Number - Advanced', cost_price: 250, markup_price: 0 },
        { id: 'bvn_phone_basic', service_category: 'bvn', name: 'Phone Number - Basic', cost_price: 250, markup_price: 0 },
        { id: 'bvn_phone_advanced', service_category: 'bvn', name: 'Phone Number - Advanced', cost_price: 300, markup_price: 0 },
        { id: 'bvn_card', service_category: 'bvn', name: 'BVN Card Layout', cost_price: 250, markup_price: 0 }
    ];

    console.log('Inserting 5 new screenshot BVN pricing items...');
    for (const item of bvnPricingDefaults) {
        const { error: insertErr } = await supabase
            .from('service_pricing')
            .insert(item);
        if (insertErr) {
            console.error(`Insert failed for ${item.id}:`, insertErr);
        } else {
            console.log(`Successfully inserted ${item.id}`);
        }
    }
}

run();

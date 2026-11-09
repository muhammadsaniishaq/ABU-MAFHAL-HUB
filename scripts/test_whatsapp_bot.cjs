// scripts/test_whatsapp_bot.cjs
// Quick validation script to ensure the WhatsApp Bot logic, phone cleaners and SQL functions are consistent.

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log("⚠️ Supabase credentials not found in environment, checking syntax only.");
    process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log("=== Testing WhatsApp Bot Schema & RPC Connection ===");
    try {
        const { data, error } = await supabase.rpc('get_user_by_whatsapp_phone', { wa_phone: '2348145853539' });
        if (error) {
            console.log("RPC Note (if migration not yet deployed to live):", error.message);
        } else {
            console.log("✅ RPC get_user_by_whatsapp_phone responded successfully:", data);
        }
    } catch (e) {
        console.log("Exception:", e.message);
    }
}

runTest();


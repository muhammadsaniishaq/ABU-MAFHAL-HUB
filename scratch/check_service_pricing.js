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

async function run() {
    const { data, error } = await supabase.from('service_pricing').select('*');
    if (error) {
        console.error('Error fetching service_pricing:', error);
    } else {
        console.log('Service Pricing entries:');
        console.log(JSON.stringify(data, null, 2));
    }
}
run();

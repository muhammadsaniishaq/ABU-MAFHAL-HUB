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
    console.log('Querying database policies for service_pricing...');
    // We can run an RPC or query a view if we have access, or check if we can write to it
    const { data: policies, error: polErr } = await supabase.rpc('execute_sql', {
        query_text: "SELECT * FROM pg_policies WHERE tablename = 'service_pricing'"
    });
    
    if (polErr) {
        console.error('Error executing SQL via execute_sql:', polErr.message);
        // Fallback: try raw query or inspect table structure
        const { data, error } = await supabase.from('service_pricing').select('*').limit(1);
        console.log('Select query status:', error ? 'Failed: ' + error.message : 'Success!');
    } else {
        console.log('Policies found:');
        console.log(JSON.stringify(policies, null, 2));
    }
}
run();

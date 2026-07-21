const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = require('path').resolve(__dirname, '.env');
require('dotenv').config({ path: envPath });

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns in profiles:', Object.keys(data[0]));
            console.log('Sample data:', data[0]);
        } else {
            console.log('Profiles table is empty.');
        }
    }
}
checkSchema();

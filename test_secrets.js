import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Checking system_secrets table...");
    const { data, error } = await supabase.from('system_secrets').select('*');
    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("Secrets found:", data);
    }
}
test();

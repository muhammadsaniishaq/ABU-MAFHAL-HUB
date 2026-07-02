const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  // Query all tables in public schema
  const { data, error } = await supabase.rpc('get_tables'); // Or try running standard SQL via query if rpc doesn't exist
  if (error) {
    console.log("RPC get_tables failed. Trying raw query via REST...");
    const { data: tables, error: queryError } = await supabase.from('profiles').select('id').limit(1);
    console.log("Connection check:", queryError ? "failed" : "success");
    
    // Let's query tables via PostgreSQL using the SQL query command
    const exec = require('child_process').execSync;
    try {
        const out = exec('supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'"');
        console.log("Tables in DB:\n", out.toString());
    } catch (e) {
        console.error("Failed to query db:", e.message);
    }
  } else {
    console.log("Tables:", data);
  }
}

listTables();

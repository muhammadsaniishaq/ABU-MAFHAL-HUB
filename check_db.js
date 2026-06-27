const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Supabase URL:", supabaseUrl);
  
  // Check virtual accounts
  const { data: vas, error: vaErr } = await supabase
    .from('virtual_accounts')
    .select('*')
    .limit(10);
  
  if (vaErr) {
    console.error("Error reading virtual_accounts:", vaErr);
  } else {
    console.log("Virtual Accounts (sample):", vas);
  }

  // Check profiles
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, balance')
    .limit(5);

  if (pErr) {
    console.error("Error reading profiles:", pErr);
  } else {
    console.log("Profiles (sample):", profiles);
  }
}

check();

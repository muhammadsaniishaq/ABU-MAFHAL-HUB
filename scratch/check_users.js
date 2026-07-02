const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email, full_name, role, status, balance');
  if (pError) {
    console.error("Error fetching profiles:", pError);
  } else {
    console.log("Profiles in DB:", profiles);
  }

  const { data: pricing, error: prError } = await supabase.from('service_pricing').select('*').eq('service_category', 'nin');
  if (prError) {
    console.error("Error fetching pricing:", prError);
  } else {
    console.log("NIN Pricing in DB:", pricing);
  }
}

checkUsers();

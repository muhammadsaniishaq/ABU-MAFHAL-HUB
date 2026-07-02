const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFlags() {
  const { data, error } = await supabase.from('feature_flags').select('*');
  if (error) {
    console.error("Error fetching feature_flags:", error);
  } else {
    console.log("Feature Flags in DB:", data);
  }
}

checkFlags();

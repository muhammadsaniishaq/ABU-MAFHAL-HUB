require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('payment_events').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("PAYMENT EVENTS:");
  console.log(JSON.stringify(data, null, 2));
}
check();

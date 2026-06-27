import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf-8');
const urlMatch = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_KEY = keyMatch[1].trim();

async function fetchEvents() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payment_events?select=*&order=created_at.desc&limit=5`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

fetchEvents();

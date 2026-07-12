const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkFlags() {
  const file = fs.readFileSync('utils/supabase.ts', 'utf8');
  const urlMatch = file.match(/const supabaseUrl = ['"]([^'"]+)['"]/);
  const keyMatch = file.match(/const supabaseAnonKey = ['"]([^'"]+)['"]/);
  
  if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    const { data, error } = await supabase.from('feature_flags').select('*');
    console.log(data);
  }
}
checkFlags();

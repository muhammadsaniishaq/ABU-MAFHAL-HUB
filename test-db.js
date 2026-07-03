const { createClient } = require('@supabase/supabase-js');

const url = 'https://uagcxrtdqttayulvgpwg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZ2N4cnRkcXR0YXl1bHZncHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzc3OTIsImV4cCI6MjA4NDIxMzc5Mn0.7AzXKou9G3tHFIduDL5TQ3fkski6P9CBGdlqfi_pMI8';
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase
        .from('system_secrets')
        .select('*');
        
    console.log(JSON.stringify(data, null, 2));
    if (error) console.error(error);
}
run();

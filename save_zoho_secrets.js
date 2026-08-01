const { createClient } = require('@supabase/supabase-js');

const url = 'https://uagcxrtdqttayulvgpwg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZ2N4cnRkcXR0YXl1bHZncHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzc3OTIsImV4cCI6MjA4NDIxMzc5Mn0.7AzXKou9G3tHFIduDL5TQ3fkski6P9CBGdlqfi_pMI8';
const supabase = createClient(url, key);

async function saveZohoSecrets() {
    console.log("Saving Zoho OAuth Secrets to Supabase system_secrets table...");

    const zohoSecrets = [
        { key: 'ZOHO_ORG_ID', value: '911972993', description: 'Zoho Mail Organization ID (ZOID)' },
        { key: 'ZOHO_CLIENT_ID', value: '1000.XGFAO3DIJ6T334FTCGSB9DL0DIUILH', description: 'Zoho OAuth API Client ID' },
        { key: 'ZOHO_CLIENT_SECRET', value: '03c230ab9c0dcdfb89c8c2bd19377f9d8c45e97946', description: 'Zoho OAuth API Client Secret' },
        { key: 'ZOHO_REFRESH_TOKEN', value: '1000.d1eaf7983dc0df2b7c18690aff46284e.b147c42954cf75e714d87bacd3f4401c', description: 'Zoho OAuth API Permanent Refresh Token' }
    ];

    for (const secret of zohoSecrets) {
        const { error } = await supabase.from('system_secrets').upsert({
            key: secret.key,
            value: secret.value,
            description: secret.description,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (error) {
            console.error(`Error saving ${secret.key}:`, error.message);
        } else {
            console.log(`✅ Saved ${secret.key} successfully!`);
        }
    }

    console.log("All Zoho OAuth secrets saved successfully!");
}

saveZohoSecrets();

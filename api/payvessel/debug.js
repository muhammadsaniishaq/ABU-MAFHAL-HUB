const { createClient } = require('@supabase/supabase-js');

async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const payvesselSecret = process.env.PAYVESSEL_API_SECRET;

  const debugInfo = {
    env: {
      SUPABASE_URL: supabaseUrl ? `Present (Length: ${supabaseUrl.length})` : 'Missing',
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey 
        ? `Present (Length: ${supabaseServiceRoleKey.length}, Ends with: ...${supabaseServiceRoleKey.slice(-4)})` 
        : 'Missing',
      PAYVESSEL_API_SECRET: payvesselSecret 
        ? `Present (Length: ${payvesselSecret.length}, Ends with: ...${payvesselSecret.slice(-4)})` 
        : 'Missing',
    },
    databaseConnection: null,
    systemSecrets: null,
    virtualAccountsSample: null,
    profilesSample: null,
    errors: []
  };

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    debugInfo.errors.push('Missing Supabase configuration. Webhook cannot operate.');
    return res.status(500).json(debugInfo);
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    debugInfo.databaseConnection = 'Attempting connection...';

    // 1. Try to query system_secrets
    try {
      const { data, error } = await supabaseAdmin.from('system_secrets').select('*');
      if (error) {
        debugInfo.errors.push(`system_secrets query error: ${error.message}`);
      } else {
        debugInfo.systemSecrets = data.map(row => ({
          key: row.key,
          valueLength: row.value ? row.value.length : 0,
          valueEnd: row.value ? `...${row.value.slice(-4)}` : null,
          description: row.description
        }));
      }
    } catch (err) {
      debugInfo.errors.push(`system_secrets execution error: ${err.message}`);
    }

    // 2. Try to query virtual_accounts (limit 1)
    try {
      const { data, error } = await supabaseAdmin.from('virtual_accounts').select('*').limit(1);
      if (error) {
        debugInfo.errors.push(`virtual_accounts query error: ${error.message}`);
      } else {
        debugInfo.virtualAccountsSample = data;
      }
    } catch (err) {
      debugInfo.errors.push(`virtual_accounts execution error: ${err.message}`);
    }

    // 3. Try to query profiles (limit 1)
    try {
      const { data, error } = await supabaseAdmin.from('profiles').select('id, email, full_name, balance').limit(1);
      if (error) {
        debugInfo.errors.push(`profiles query error: ${error.message}`);
      } else {
        debugInfo.profilesSample = data;
      }
    } catch (err) {
      debugInfo.errors.push(`profiles execution error: ${err.message}`);
    }

    debugInfo.databaseConnection = 'Successful (Admin client queries completed)';

  } catch (err) {
    debugInfo.databaseConnection = 'Failed';
    debugInfo.errors.push(`Client initialization error: ${err.message}`);
  }

  return res.status(200).json(debugInfo);
}

module.exports = handler;

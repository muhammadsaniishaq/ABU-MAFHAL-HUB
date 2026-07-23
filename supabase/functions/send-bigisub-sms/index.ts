import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { payload, BIGIHUB_API_URL } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Tokens securely from system_secrets using Admin Privileges
    const { data: secretData, error: secretError } = await supabaseAdmin
        .from('system_secrets')
        .select('key, value')
        .in('key', ['BIGI_API_TOKEN', 'BIGI_API_PIN']);

    const tokenObj = secretData?.find(s => s.key === 'BIGI_API_TOKEN');
    const pinObj = secretData?.find(s => s.key === 'BIGI_API_PIN');

    if (secretError || !tokenObj?.value) {
        throw new Error('BIGI_API_TOKEN not found in API Vault.');
    }

    // Assign PIN to payload
    payload.pin = pinObj?.value || '1234';
    payload.pin_code = pinObj?.value || '1234';

    // 2. Make Request to Bigisub
    const response = await fetch(BIGIHUB_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${tokenObj.value}`
        },
        body: JSON.stringify(payload)
    });

    const textResponse = await response.text();
    let result: any = {};
    try { result = textResponse ? JSON.parse(textResponse) : {}; } catch (e) {}

    if (response.ok || result.status === 'success') {
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } else {
        let errorMsg = result.message || textResponse;
        if (response.status === 400 && result.errors) {
            errorMsg += ' - Details: ' + JSON.stringify(result.errors);
        } else if (response.status === 400 && typeof result === 'object') {
            errorMsg += ' - Payload Details: ' + JSON.stringify(result);
        }
        throw new Error(errorMsg || `HTTP ${response.status}`);
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

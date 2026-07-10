import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUMSUB_APP_TOKEN = Deno.env.get('SUMSUB_APP_TOKEN') ?? '';
const SUMSUB_SECRET_KEY = Deno.env.get('SUMSUB_SECRET_KEY') ?? '';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userId = user.id;
    // You can customize the levelName based on your Sumsub dashboard
    const levelName = 'basic-kyc-level'; 
    const ttlInSecs = 1200;

    const path = `/resources/accessTokens?userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=${ttlInSecs}`;
    const ts = Math.floor(Date.now() / 1000).toString();
    const method = 'POST';

    // Sumsub requires signature: ts + method + path
    const signatureStr = ts + method + path;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(SUMSUB_SECRET_KEY);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureData = encoder.encode(signatureStr);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signatureData);
    
    // Convert to Hex
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signatureHex,
        'X-App-Access-Ts': ts,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Sumsub error:", data);
      return new Response(JSON.stringify({ error: 'Failed to generate Sumsub token', details: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    return new Response(JSON.stringify({ token: data.token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error("Internal Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

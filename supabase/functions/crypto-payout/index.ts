import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { gasType, walletAddress, amountGas } = await req.json();

        // 1. Validate auth
        const authHeader = req.headers.get('Authorization')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Unauthorized");

        let txId = "";

        // 2. Fetch NowPayments Secrets
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
        let NOWPAYMENTS_EMAIL = Deno.env.get('NOWPAYMENTS_EMAIL');
        let NOWPAYMENTS_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            const { data: secrets } = await supabaseAdmin.from('system_secrets').select('*').in('key', ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_EMAIL', 'NOWPAYMENTS_PASSWORD']);
            if (secrets) {
                const apiSecret = secrets.find(s => s.key === 'NOWPAYMENTS_API_KEY');
                const emailSecret = secrets.find(s => s.key === 'NOWPAYMENTS_EMAIL');
                const passSecret = secrets.find(s => s.key === 'NOWPAYMENTS_PASSWORD');
                if (apiSecret) NOWPAYMENTS_API_KEY = apiSecret.value;
                if (emailSecret) NOWPAYMENTS_EMAIL = emailSecret.value;
                if (passSecret) NOWPAYMENTS_PASSWORD = passSecret.value;
            }
        }

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            throw new Error("NowPayments configuration is missing in Admin settings.");
        }

        // 3. Process Payout using NowPayments
        const authRes = await fetch('https://api.nowpayments.io/v1/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: NOWPAYMENTS_EMAIL, password: NOWPAYMENTS_PASSWORD })
        });
        
        const authData = await authRes.json();
        if (!authData.token) throw new Error("NowPayments Auth failed");

        const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
            method: 'POST',
            headers: {
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Authorization': `Bearer ${authData.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                withdrawals: [{
                    address: walletAddress,
                    currency: gasType.toLowerCase(),
                    amount: amountGas,
                    ipn_callback_url: `${SUPABASE_URL}/functions/v1/crypto-webhook`
                }]
            })
        });
        
        const payoutData = await payoutRes.json();
        
        if (payoutData && payoutData.withdrawals && payoutData.withdrawals.length > 0) {
            txId = payoutData.withdrawals[0].id;
        } else {
            console.error("Payout API failed:", payoutData);
            throw new Error(payoutData.message || 'Unknown NowPayments error');
        }

        return new Response(JSON.stringify({ success: true, txId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

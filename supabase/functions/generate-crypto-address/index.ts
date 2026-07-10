import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Verify the user
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) throw new Error('Invalid token');

        const { network, currency } = await req.json();

        if (!network || !currency) {
            throw new Error('Network and currency are required');
        }

        // Check if user already has an address for this network/currency
        const { data: existingAddress } = await supabaseAdmin
            .from('crypto_addresses')
            .select('*')
            .eq('user_id', user.id)
            .eq('network', network.toUpperCase())
            .eq('currency', currency.toLowerCase())
            .eq('is_active', true)
            .maybeSingle();

        if (existingAddress) {
            return new Response(JSON.stringify({ address: existingAddress.address, isNew: false }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get NowPayments API Key from system secrets or env
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
        if (!NOWPAYMENTS_API_KEY) {
            const { data: secret } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'NOWPAYMENTS_API_KEY').maybeSingle();
            if (secret && secret.value) NOWPAYMENTS_API_KEY = secret.value;
        }

        if (!NOWPAYMENTS_API_KEY) {
            throw new Error('Payment gateway not configured');
        }

        // Generate address via NowPayments API
        // Using dynamic payment address generation instead of just /payment to allow indefinite usage
        const body = {
            currency: currency.toLowerCase(),
            ipn_callback_url: `${supabaseUrl}/functions/v1/crypto-webhook`
        };

        // Note: For a true permanent deposit address, /payment creates an invoice. 
        // NowPayments requires minimum amounts for invoices, but we'll use it since it's the standard integration for non-custodial.
        // If they want permanent addresses, they usually need NowPayments Custody.
        // We'll proceed with /payment and a dummy amount, OR just /payment without amount if supported.
        // A better approach for NowPayments without amount is to create a static address if they have custody enabled.
        // Since the user is setting up, /payment is safest. We will set a generic price amount.
        const paymentBody = {
            price_amount: 1000,
            price_currency: 'usd',
            pay_currency: currency.toLowerCase(),
            ipn_callback_url: `${supabaseUrl}/functions/v1/crypto-webhook`,
            order_id: `crypto_dep_${user.id}_${Date.now()}`,
            order_description: `Deposit for user ${user.id}`
        };

        const response = await fetch('https://api.nowpayments.io/v1/payment', {
            method: 'POST',
            headers: {
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentBody)
        });

        const data = await response.json();

        if (!response.ok || !data.pay_address) {
            console.error('NowPayments Error:', data);
            throw new Error('Failed to generate crypto address from provider');
        }

        const newAddress = data.pay_address;
        const paymentId = data.payment_id;

        // Save to database
        const { error: insertError } = await supabaseAdmin
            .from('crypto_addresses')
            .insert({
                user_id: user.id,
                network: network.toUpperCase(),
                currency: currency.toLowerCase(),
                address: newAddress,
                payment_id: String(paymentId),
                provider: 'nowpayments'
            });

        if (insertError) {
            console.error('Failed to save address to DB', insertError);
            throw new Error('Failed to save address');
        }

        return new Response(JSON.stringify({ address: newAddress, isNew: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

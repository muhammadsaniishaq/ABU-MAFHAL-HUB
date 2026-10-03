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

        const { network, currency, regenerate, amountUsd } = await req.json();

        if (!network || !currency) {
            throw new Error('Network and currency are required');
        }

        const normCurrency = currency.toLowerCase().trim();
        const normNetwork = network.toUpperCase().trim();

        // Check if user already has an active address for this network/currency combo (unless regenerate requested)
        if (!regenerate) {
            const { data: existingAddress } = await supabaseAdmin
                .from('crypto_addresses')
                .select('*')
                .eq('user_id', user.id)
                .eq('network', normNetwork)
                .eq('currency', normCurrency)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingAddress) {
                return new Response(JSON.stringify({ 
                    address: existingAddress.address, 
                    payment_id: existingAddress.payment_id,
                    network: existingAddress.network,
                    currency: existingAddress.currency,
                    isNew: false 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // Get NowPayments API Key from system secrets or env
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY') || Deno.env.get('NOWPAYMENTS_KEY');
        if (!NOWPAYMENTS_API_KEY) {
            const { data: secrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_KEY']);

            if (secrets && secrets.length > 0) {
                const found = secrets.find(s => s.value && s.value.trim().length > 0);
                if (found) NOWPAYMENTS_API_KEY = found.value.trim();
            }
        }

        if (!NOWPAYMENTS_API_KEY) {
            throw new Error('NowPayments Gateway is not configured. Please contact administrator.');
        }

        // Standard deposit nominal price amount (default $5 or $10 so test deposits match easily)
        const nominalAmount = amountUsd && Number(amountUsd) > 0 ? Number(amountUsd) : 5;

        const paymentBody = {
            price_amount: nominalAmount,
            price_currency: 'usd',
            pay_currency: normCurrency,
            ipn_callback_url: `${supabaseUrl}/functions/v1/crypto-webhook`,
            order_id: `crypto_dep_${user.id}_${Date.now()}`,
            order_description: `Deposit for user ${user.id} on Abu Mafhal Hub`
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
            console.error('[NowPayments Address Gen Error]:', data);
            throw new Error(data.message || 'Failed to generate crypto address from provider');
        }

        const newAddress = data.pay_address;
        const paymentId = String(data.payment_id || '');

        // If regenerate was true, deactivate older addresses for this currency/network
        if (regenerate) {
            await supabaseAdmin
                .from('crypto_addresses')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('network', normNetwork)
                .eq('currency', normCurrency);
        }

        // Save to database
        const { error: insertError } = await supabaseAdmin
            .from('crypto_addresses')
            .upsert({
                user_id: user.id,
                network: normNetwork,
                currency: normCurrency,
                address: newAddress,
                payment_id: paymentId,
                provider: 'nowpayments',
                is_active: true
            }, { onConflict: 'user_id,network,currency' });

        if (insertError) {
            console.error('Failed to save address to DB', insertError);
            // Fallback insert if upsert constraint mismatch
            await supabaseAdmin.from('crypto_addresses').insert({
                user_id: user.id,
                network: normNetwork,
                currency: normCurrency,
                address: newAddress,
                payment_id: paymentId,
                provider: 'nowpayments'
            });
        }

        return new Response(JSON.stringify({ 
            address: newAddress, 
            payment_id: paymentId,
            network: normNetwork,
            currency: normCurrency,
            isNew: true 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Generate Crypto Address Error]:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

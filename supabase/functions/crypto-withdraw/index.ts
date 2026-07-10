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

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) throw new Error('Invalid token');

        const { network, address, amountUsdt } = await req.json();

        if (!network || !address || !amountUsdt || amountUsdt <= 0) {
            throw new Error('Invalid withdrawal parameters');
        }

        // Deduct balance securely via RPC
        const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: 'usdt',
            amount: amountUsdt
        });

        if (deductError || !deductionResult?.success) {
            console.error("Deduction error:", deductError || deductionResult);
            throw new Error(deductionResult?.error || 'Insufficient crypto balance or error');
        }

        // Try NowPayments Payout
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
        let NOWPAYMENTS_EMAIL = Deno.env.get('NOWPAYMENTS_EMAIL');
        let NOWPAYMENTS_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');

        // Fetch from system_secrets if not in env
        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            const { data: secrets } = await supabaseAdmin.from('system_secrets').select('key, value');
            if (secrets) {
                const apiSecret = secrets.find(s => s.key === 'NOWPAYMENTS_API_KEY');
                const emailSecret = secrets.find(s => s.key === 'NOWPAYMENTS_EMAIL');
                const passSecret = secrets.find(s => s.key === 'NOWPAYMENTS_PASSWORD');
                if (apiSecret) NOWPAYMENTS_API_KEY = apiSecret.value;
                if (emailSecret) NOWPAYMENTS_EMAIL = emailSecret.value;
                if (passSecret) NOWPAYMENTS_PASSWORD = passSecret.value;
            }
        }

        let payoutSuccessful = false;
        let payoutId = null;

        if (NOWPAYMENTS_API_KEY && NOWPAYMENTS_EMAIL && NOWPAYMENTS_PASSWORD) {
            try {
                // 1. Get Auth Token
                const authRes = await fetch('https://api.nowpayments.io/v1/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: NOWPAYMENTS_EMAIL,
                        password: NOWPAYMENTS_PASSWORD
                    })
                });
                const authData = await authRes.json();

                if (authData.token) {
                    // 2. Request Payout
                    const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
                        method: 'POST',
                        headers: {
                            'x-api-key': NOWPAYMENTS_API_KEY,
                            'Authorization': `Bearer ${authData.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            withdrawals: [{
                                address: address,
                                currency: `usdt${network.toLowerCase()}`,
                                amount: amountUsdt,
                                ipn_callback_url: `${supabaseUrl}/functions/v1/crypto-webhook`
                            }]
                        })
                    });
                    
                    const payoutData = await payoutRes.json();
                    if (payoutData && payoutData.withdrawals && payoutData.withdrawals.length > 0) {
                        payoutSuccessful = true;
                        payoutId = payoutData.withdrawals[0].id;
                    } else {
                        console.error("Payout API failed:", payoutData);
                        // Reverse the balance deduction since payout failed
                        await supabaseAdmin.rpc('credit_crypto_balance', {
                            user_id: user.id,
                            asset: 'usdt',
                            amount: amountUsdt
                        });
                        throw new Error('Payout failed from provider: ' + (payoutData.message || 'Unknown'));
                    }
                } else {
                    // Auth failed, reverse balance
                    await supabaseAdmin.rpc('credit_crypto_balance', {
                        user_id: user.id,
                        asset: 'usdt',
                        amount: amountUsdt
                    });
                    throw new Error('Payout authentication failed');
                }
            } catch (err: any) {
                // If the error was thrown by our own check, rethrow it
                if (err.message.includes('Payout failed') || err.message.includes('Payout authentication')) {
                     throw err;
                }
                
                // Otherwise it's a network error, reverse balance
                await supabaseAdmin.rpc('credit_crypto_balance', {
                    user_id: user.id,
                    asset: 'usdt',
                    amount: amountUsdt
                });
                throw new Error('Failed to process payout network request');
            }
        } else {
            // Revert because provider isn't configured, we shouldn't let it just disappear 
            // since they wanted automatic payout.
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: 'usdt',
                amount: amountUsdt
            });
            throw new Error('Payout provider credentials not fully configured (Needs API Key, Email, Password)');
        }

        // Record Transaction
        await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                type: 'crypto_withdrawal',
                amount: amountUsdt, // Storing in crypto equivalent
                status: payoutSuccessful ? 'success' : 'pending',
                reference: payoutId ? String(payoutId) : null,
                description: `Withdrawal: ${amountUsdt} USDT via ${network} to ${address}`
            });

        return new Response(JSON.stringify({ success: true, message: 'Withdrawal processed successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Crypto Withdraw Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 200, // Returning 200 so the frontend can read the `error` object cleanly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

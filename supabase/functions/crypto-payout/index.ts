import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://uagcxrtdqttayulvgpwg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let user: any = null;
    let paymentMethod: string = 'NGN';
    let amountPayment: number = 0;
    let supabaseAdmin: any = null;

    try {
        const body = await req.json();
        const { gasType, walletAddress, amountGas } = body;
        paymentMethod = body.paymentMethod || 'NGN';
        amountPayment = Number(body.amountPayment) || 0;

        if (!gasType || !walletAddress || !amountGas || amountPayment <= 0) {
            throw new Error("Invalid payment parameters. Please enter valid amount and address.");
        }

        // 1. Validate auth via admin client using raw JWT token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing authorization token.");

        const token = authHeader.replace('Bearer ', '').trim();
        supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !userData?.user) {
            throw new Error("Session expired or unauthorized. Please re-login.");
        }
        user = userData.user;

        // 2. SECURELY DEDUCT BALANCE VIA RPC
        if (paymentMethod === 'NGN') {
            const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_balance', {
                user_id: user.id,
                amount: amountPayment
            });
            if (deductError || !deductionResult?.success) {
                console.error("NGN Deduction error:", deductError || deductionResult);
                throw new Error(deductionResult?.error || deductError?.message || "Insufficient Naira balance.");
            }
        } else if (paymentMethod === 'USDT') {
            const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
                user_id: user.id,
                asset: 'usdt',
                amount: amountPayment
            });
            if (deductError || !deductionResult?.success) {
                console.error("USDT Deduction error:", deductError || deductionResult);
                throw new Error(deductionResult?.error || deductError?.message || "Insufficient USDT balance.");
            }
        } else {
            throw new Error("Invalid payment method selected.");
        }

        let txId = "";

        // 3. Fetch NowPayments Secrets
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
        let NOWPAYMENTS_EMAIL = Deno.env.get('NOWPAYMENTS_EMAIL');
        let NOWPAYMENTS_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            const { data: secrets } = await supabaseAdmin.from('system_secrets').select('key, value').in('key', [
                'NOWPAYMENTS_API_KEY', 
                'NOWPAYMENTS_KEY',
                'NOWPAYMENTS_EMAIL', 
                'NOWPAYMENTS_PASSWORD'
            ]);
            if (secrets) {
                const apiSecret = secrets.find((s: any) => s.key === 'NOWPAYMENTS_API_KEY' || s.key === 'NOWPAYMENTS_KEY');
                const emailSecret = secrets.find((s: any) => s.key === 'NOWPAYMENTS_EMAIL');
                const passSecret = secrets.find((s: any) => s.key === 'NOWPAYMENTS_PASSWORD');
                if (apiSecret && !NOWPAYMENTS_API_KEY) NOWPAYMENTS_API_KEY = apiSecret.value;
                if (emailSecret) NOWPAYMENTS_EMAIL = emailSecret.value;
                if (passSecret) NOWPAYMENTS_PASSWORD = passSecret.value;
            }
        }

        if (!NOWPAYMENTS_API_KEY) {
            // REFUND IF MISSING API KEY
            if (paymentMethod === 'NGN') {
                await supabaseAdmin.rpc('fund_wallet', { p_user_id: user.id, p_amount: amountPayment });
            } else if (paymentMethod === 'USDT') {
                await supabaseAdmin.rpc('credit_crypto_balance', { user_id: user.id, asset: 'usdt', amount: amountPayment });
            }
            throw new Error("NOWPayments API Key is not configured in Admin Settings.");
        }

        // 4. Process Payout using NowPayments
        let authToken = "";
        if (NOWPAYMENTS_EMAIL && NOWPAYMENTS_PASSWORD) {
            try {
                const authRes = await fetch('https://api.nowpayments.io/v1/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: NOWPAYMENTS_EMAIL, password: NOWPAYMENTS_PASSWORD })
                });
                const authData = await authRes.json();
                if (authData?.token) {
                    authToken = authData.token;
                }
            } catch (authErr) {
                console.warn("NOWPayments auth token fetch notice:", authErr);
            }
        }

        const payoutHeaders: Record<string, string> = {
            'x-api-key': NOWPAYMENTS_API_KEY,
            'Content-Type': 'application/json'
        };
        if (authToken) {
            payoutHeaders['Authorization'] = `Bearer ${authToken}`;
        }

        const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
            method: 'POST',
            headers: payoutHeaders,
            body: JSON.stringify({
                withdrawals: [{
                    address: walletAddress.trim(),
                    currency: gasType.toLowerCase(),
                    amount: amountGas,
                    ipn_callback_url: `${SUPABASE_URL}/functions/v1/crypto-webhook`
                }]
            })
        });

        const payoutData = await payoutRes.json();

        if (payoutData && payoutData.withdrawals && payoutData.withdrawals.length > 0) {
            txId = String(payoutData.withdrawals[0].id || payoutData.withdrawals[0].batch_withdrawal_id || Date.now());
        } else if (payoutData?.id || payoutData?.batch_withdrawal_id) {
            txId = String(payoutData.id || payoutData.batch_withdrawal_id);
        } else {
            console.error("Payout API response:", payoutData);
            // Reverse balance deduction so user does not lose money
            if (paymentMethod === 'NGN') {
                await supabaseAdmin.rpc('fund_wallet', { p_user_id: user.id, p_amount: amountPayment });
            } else if (paymentMethod === 'USDT') {
                await supabaseAdmin.rpc('credit_crypto_balance', { user_id: user.id, asset: 'usdt', amount: amountPayment });
            }
            const providerErrMsg = payoutData?.message || payoutData?.error || "NOWPayments rejected payout request. Check wallet address or minimum limit.";
            throw new Error(`Payout Provider Notice: ${providerErrMsg}`);
        }

        return new Response(JSON.stringify({ success: true, txId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("crypto-payout error:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error?.message || "Could not complete gas purchase." 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Returning 200 so Supabase JS client parses JSON cleanly without throwing raw HTTP errors
        });
    }
});

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
    let supabaseAdmin: any = null;
    let balanceDeducted = false;
    let paymentMethod = 'NGN';
    let amountPayment = 0;

    try {
        const body = await req.json();
        const { gasType, walletAddress, amountGas } = body;
        paymentMethod = body.paymentMethod || 'NGN';
        amountPayment = Number(body.amountPayment) || 0;

        // ── Input Validation ───────────────────────────────────────────────────
        if (!gasType || !walletAddress || !amountGas || amountPayment <= 0) {
            throw new Error("Invalid payment parameters. Please enter valid amount and address.");
        }
        if (amountGas <= 0) {
            throw new Error("Gas amount must be greater than zero.");
        }

        // ── 1. Authenticate user from JWT ──────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing authorization token.");

        const token = authHeader.replace('Bearer ', '').trim();
        supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !userData?.user) {
            throw new Error("Session expired or unauthorized. Please re-login.");
        }
        user = userData.user;

        // ── 2. Load NowPayments credentials ───────────────────────────────────
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
        let NOWPAYMENTS_EMAIL = Deno.env.get('NOWPAYMENTS_EMAIL');
        let NOWPAYMENTS_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            const { data: secrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_KEY', 'NOWPAYMENTS_EMAIL', 'NOWPAYMENTS_PASSWORD']);

            if (secrets) {
                const apiKey  = secrets.find((s: any) => s.key === 'NOWPAYMENTS_API_KEY' || s.key === 'NOWPAYMENTS_KEY');
                const email   = secrets.find((s: any) => s.key === 'NOWPAYMENTS_EMAIL');
                const pass    = secrets.find((s: any) => s.key === 'NOWPAYMENTS_PASSWORD');
                if (apiKey && !NOWPAYMENTS_API_KEY) NOWPAYMENTS_API_KEY = apiKey.value;
                if (email)  NOWPAYMENTS_EMAIL    = email.value;
                if (pass)   NOWPAYMENTS_PASSWORD = pass.value;
            }
        }

        if (!NOWPAYMENTS_API_KEY) {
            // Do NOT charge user if provider is not configured
            throw new Error("Gas payout service is temporarily unavailable. Please contact support.");
        }

        // ── 3. Authenticate with NowPayments to get JWT ───────────────────────
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
                } else {
                    console.warn("NowPayments auth: no token returned", authData);
                }
            } catch (authErr) {
                console.warn("NowPayments auth fetch error:", authErr);
                // Proceed with API key only if JWT auth fails
            }
        }

        // ── 4. Send payout request to NowPayments BEFORE charging user ────────
        const payoutHeaders: Record<string, string> = {
            'x-api-key': NOWPAYMENTS_API_KEY,
            'Content-Type': 'application/json'
        };
        if (authToken) {
            payoutHeaders['Authorization'] = `Bearer ${authToken}`;
        }

        const payoutBody = {
            withdrawals: [{
                address: walletAddress.trim(),
                currency: gasType.toLowerCase(),
                amount: amountGas,
                ipn_callback_url: `${SUPABASE_URL}/functions/v1/crypto-webhook`
            }]
        };

        console.log(`Gas payout attempt: ${amountGas} ${gasType} → ${walletAddress.slice(0,10)}...`);

        const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
            method: 'POST',
            headers: payoutHeaders,
            body: JSON.stringify(payoutBody)
        });

        const payoutData = await payoutRes.json();
        console.log("NowPayments payout response:", JSON.stringify(payoutData));

        // ── 5. Validate payout was accepted ───────────────────────────────────
        let txId = "";
        let providerStatus = "";
        let realTxHash = "";

        if (payoutData?.withdrawals && payoutData.withdrawals.length > 0) {
            const w = payoutData.withdrawals[0];
            txId = String(w.id || w.batch_withdrawal_id || '');
            providerStatus = String(w.status || 'created');
            realTxHash = String(w.hash || w.tx_hash || '');
        } else if (payoutData?.id || payoutData?.batch_withdrawal_id) {
            txId = String(payoutData.id || payoutData.batch_withdrawal_id);
            providerStatus = String(payoutData.status || 'created');
            realTxHash = String(payoutData.hash || payoutData.tx_hash || '');
        } else {
            // Payout was rejected by provider — DO NOT charge user
            const providerErr = payoutData?.message || payoutData?.error || "NowPayments rejected payout.";
            console.error("Payout rejected by provider:", providerErr, payoutData);
            throw new Error(`Payout failed: ${providerErr}`);
        }

        // ── 6. Payout ACCEPTED — now deduct user balance ──────────────────────
        if (paymentMethod === 'NGN') {
            const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc('deduct_balance', {
                user_id: user.id,
                amount: amountPayment
            });
            if (deductErr || !deductResult?.success) {
                // Payout went through but deduction failed — log this for admin review
                console.error("CRITICAL: Payout sent but deduction failed. Manual review needed.", {
                    userId: user.id, txId, deductErr, deductResult
                });
                // Still return success to user since gas was dispatched
                // Admin must reconcile manually
                balanceDeducted = false;
            } else {
                balanceDeducted = true;
            }
        } else if (paymentMethod === 'USDT') {
            const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc('deduct_crypto_balance', {
                user_id: user.id,
                asset: 'usdt',
                amount: amountPayment
            });
            if (deductErr || !deductResult?.success) {
                console.error("CRITICAL: Payout sent but USDT deduction failed.", {
                    userId: user.id, txId, deductErr, deductResult
                });
                balanceDeducted = false;
            } else {
                balanceDeducted = true;
            }
        }

        // ── 7. Log the gas order with real provider TX ID ─────────────────────
        try {
            await supabaseAdmin.from('crypto_gas_orders').insert({
                user_id: user.id,
                gas_type: gasType.toLowerCase(),
                wallet_address: walletAddress.trim(),
                amount_fiat: paymentMethod === 'NGN' ? amountPayment : amountPayment * 1600,
                amount_gas: amountGas,
                payment_method: paymentMethod,
                status: 'completed',
                provider_tx_id: txId,
                tx_hash: realTxHash || null,
                reference: txId || undefined,
            });
        } catch (logErr) {
            console.warn("Gas order log error (non-critical):", logErr);
        }

        // ── 8. Log transaction record ─────────────────────────────────────────
        try {
            await supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_gas',
                amount: paymentMethod === 'NGN' ? amountPayment : amountPayment * 1600,
                status: 'completed',
                reference: txId,
                description: `Gas Refill: ${amountGas} ${gasType.toUpperCase()} → ${walletAddress.trim()} (Provider Ref: ${txId})`
            });
        } catch (txLogErr) {
            console.warn("Transaction log error (non-critical):", txLogErr);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            txId,
            txHash: realTxHash || null,
            status: providerStatus || 'submitted',
            balanceDeducted,
            gasType,
            amountGas,
            walletAddress: walletAddress.trim()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("crypto-payout error:", error?.message || error);

        // Ensure user is NEVER charged if payout did not succeed
        // balanceDeducted is false at this point — no refund needed
        
        return new Response(JSON.stringify({ 
            success: false, 
            error: error?.message || "Could not complete gas purchase. Please try again."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});

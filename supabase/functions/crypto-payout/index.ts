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

        // ── 2. Load provider credentials & hot wallet keys from system_secrets ──
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
        let NOWPAYMENTS_EMAIL = Deno.env.get('NOWPAYMENTS_EMAIL');
        let NOWPAYMENTS_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');
        let TRON_PRIVATE_KEY = Deno.env.get('TRON_PRIVATE_KEY') || Deno.env.get('TRON_HOT_WALLET_KEY');
        let EVM_PRIVATE_KEY = Deno.env.get('EVM_PRIVATE_KEY') || Deno.env.get('HOT_WALLET_PRIVATE_KEY');

        const { data: secrets } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value')
            .in('key', [
                'NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_KEY', 
                'NOWPAYMENTS_EMAIL', 'NOWPAYMENTS_PASSWORD',
                'TRON_PRIVATE_KEY', 'TRON_HOT_WALLET_KEY',
                'EVM_PRIVATE_KEY', 'HOT_WALLET_PRIVATE_KEY'
            ]);

        if (secrets) {
            const apiKey   = secrets.find((s: any) => s.key === 'NOWPAYMENTS_API_KEY' || s.key === 'NOWPAYMENTS_KEY');
            const email    = secrets.find((s: any) => s.key === 'NOWPAYMENTS_EMAIL');
            const pass     = secrets.find((s: any) => s.key === 'NOWPAYMENTS_PASSWORD');
            const tronKey  = secrets.find((s: any) => s.key === 'TRON_PRIVATE_KEY' || s.key === 'TRON_HOT_WALLET_KEY');
            const evmKey   = secrets.find((s: any) => s.key === 'EVM_PRIVATE_KEY' || s.key === 'HOT_WALLET_PRIVATE_KEY');

            if (apiKey && !NOWPAYMENTS_API_KEY) NOWPAYMENTS_API_KEY = apiKey.value;
            if (email && !NOWPAYMENTS_EMAIL)    NOWPAYMENTS_EMAIL    = email.value;
            if (pass && !NOWPAYMENTS_PASSWORD)  NOWPAYMENTS_PASSWORD = pass.value;
            if (tronKey && !TRON_PRIVATE_KEY)   TRON_PRIVATE_KEY    = tronKey.value;
            if (evmKey && !EVM_PRIVATE_KEY)     EVM_PRIVATE_KEY     = evmKey.value;
        }

        let txId = "";
        let providerStatus = "";
        let realTxHash = "";
        const cleanGasType = gasType.toLowerCase().trim();
        const cleanAddress = walletAddress.trim();

        // ── 3. Engine 1: Direct On-Chain Dispatch via Hot Wallet ───────────────
        // For TRON (TRX): Instant on-chain broadcast via TronWeb
        if (cleanGasType === 'trx' && TRON_PRIVATE_KEY) {
            try {
                console.log(`[DISPATCH ENGINE: TRON HOT WALLET] Sending ${amountGas} TRX to ${cleanAddress.slice(0, 10)}...`);
                const { TronWeb } = await import("npm:tronweb@6.0.0");
                const tw = new TronWeb({
                    fullHost: 'https://api.trongrid.io',
                    privateKey: TRON_PRIVATE_KEY
                });
                const sunAmount = Math.floor(amountGas * 1_000_000);
                const sendResult = await tw.trx.sendTransaction(cleanAddress, sunAmount);
                console.log("[TRON BROADCAST RESULT]:", JSON.stringify(sendResult));

                if (sendResult && (sendResult.result === true || sendResult.txid)) {
                    txId = sendResult.txid || ('trx_' + Date.now());
                    realTxHash = sendResult.txid || '';
                    providerStatus = 'confirmed';
                } else {
                    const failMsg = sendResult?.message ? (typeof sendResult.message === 'string' ? sendResult.message : JSON.stringify(sendResult.message)) : 'Tron node rejected transaction';
                    console.warn("[TRON DIRECT DISPATCH FAILED]:", failMsg);
                }
            } catch (tronErr: any) {
                console.warn("[TRON DISPATCH EXCEPTION]:", tronErr?.message || tronErr);
            }
        }

        // For EVM Chains (BNB BSC, Polygon POL): Instant on-chain broadcast via ethers
        if (!txId && (cleanGasType === 'bnbbsc' || cleanGasType === 'matic') && EVM_PRIVATE_KEY) {
            try {
                console.log(`[DISPATCH ENGINE: EVM HOT WALLET] Sending ${amountGas} ${cleanGasType} to ${cleanAddress.slice(0, 10)}...`);
                const { ethers } = await import("npm:ethers@6.13.0");
                const rpcUrl = cleanGasType === 'bnbbsc' 
                    ? 'https://bsc-dataseed.binance.org/' 
                    : 'https://polygon-rpc.com';
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const wallet = new ethers.Wallet(EVM_PRIVATE_KEY, provider);
                const tx = await wallet.sendTransaction({
                    to: cleanAddress,
                    value: ethers.parseEther(String(amountGas))
                });
                console.log("[EVM BROADCAST RESULT]:", tx.hash);

                if (tx && tx.hash) {
                    txId = tx.hash;
                    realTxHash = tx.hash;
                    providerStatus = 'submitted';
                }
            } catch (evmErr: any) {
                console.warn("[EVM DISPATCH EXCEPTION]:", evmErr?.message || evmErr);
            }
        }

        // ── 4. Engine 2: NOWPayments Custodial Payout ───────────────────────────
        if (!txId && NOWPAYMENTS_API_KEY) {
            if (!NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
                // If hot wallet did not run and NowPayments credentials are incomplete
                throw new Error("Gas payout service requires provider authentication (NOWPAYMENTS_EMAIL and NOWPAYMENTS_PASSWORD or Hot Wallet in system_secrets). Your wallet balance has NOT been deducted.");
            }

            console.log(`[DISPATCH ENGINE: NOWPAYMENTS] Requesting auth token...`);
            const authRes = await fetch('https://api.nowpayments.io/v1/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: NOWPAYMENTS_EMAIL, password: NOWPAYMENTS_PASSWORD })
            });
            const authData = await authRes.json();
            if (!authData?.token) {
                const authMsg = authData?.message || authData?.error || 'Invalid credentials or custody not enabled';
                console.error("[NOWPAYMENTS AUTH FAILED]:", authMsg);
                throw new Error(`NowPayments authentication error: ${authMsg}. Your wallet balance has NOT been deducted.`);
            }

            const authToken = authData.token;
            const payoutHeaders: Record<string, string> = {
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            };

            const payoutBody = {
                withdrawals: [{
                    address: cleanAddress,
                    currency: cleanGasType,
                    amount: amountGas,
                    ipn_callback_url: `${SUPABASE_URL}/functions/v1/crypto-webhook`
                }]
            };

            console.log(`[NOWPAYMENTS PAYOUT ATTEMPT]: ${amountGas} ${cleanGasType} → ${cleanAddress.slice(0, 10)}...`);
            const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
                method: 'POST',
                headers: payoutHeaders,
                body: JSON.stringify(payoutBody)
            });

            const payoutData = await payoutRes.json();
            console.log("[NOWPAYMENTS PAYOUT RESPONSE]:", JSON.stringify(payoutData));

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
                const providerErr = payoutData?.message || payoutData?.error || "NowPayments rejected payout.";
                console.error("[NOWPAYMENTS PAYOUT REJECTED]:", providerErr);
                throw new Error(`Payout provider error: ${providerErr}. Your wallet balance has NOT been deducted.`);
            }
        }

        // ── 5. Validate that Gas was ACTUALLY dispatched ───────────────────────
        if (!txId) {
            // Neither hot wallet nor NowPayments could fulfill the order
            throw new Error("Unable to dispatch gas: No payout provider or hot wallet is currently configured. Your wallet balance has NOT been deducted.");
        }

        // ── 6. Gas DISPATCH CONFIRMED — Deduct user balance now ────────────────
        if (paymentMethod === 'NGN') {
            const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc('deduct_balance', {
                user_id: user.id,
                amount: amountPayment
            });
            if (deductErr || !deductResult?.success) {
                console.error("CRITICAL: Gas dispatched but NGN deduction failed:", {
                    userId: user.id, txId, deductErr, deductResult
                });
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
                console.error("CRITICAL: Gas dispatched but USDT deduction failed:", {
                    userId: user.id, txId, deductErr, deductResult
                });
                balanceDeducted = false;
            } else {
                balanceDeducted = true;
            }
        }

        // ── 7. Record the completed order in crypto_gas_orders ─────────────────
        try {
            await supabaseAdmin.from('crypto_gas_orders').insert({
                user_id: user.id,
                gas_type: cleanGasType,
                wallet_address: cleanAddress,
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

        // ── 8. Record transaction record ───────────────────────────────────────
        try {
            await supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_gas',
                amount: paymentMethod === 'NGN' ? amountPayment : amountPayment * 1600,
                status: 'completed',
                reference: txId,
                description: `Gas Refill: ${amountGas} ${cleanGasType.toUpperCase()} → ${cleanAddress} (Tx: ${txId})`
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
            gasType: cleanGasType,
            amountGas,
            walletAddress: cleanAddress
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("crypto-payout error:", error?.message || error);

        // Strict guarantee: User is NEVER charged if payout did not succeed
        return new Response(JSON.stringify({ 
            success: false, 
            error: error?.message || "Could not complete gas purchase. Your wallet balance has NOT been deducted."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});

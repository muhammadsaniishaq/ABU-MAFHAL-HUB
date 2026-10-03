import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nowpayments-sig',
};

// Normalize NowPayments ticker (e.g. 'usdttrc20', 'usdtbsc', 'etharb') to canonical wallet asset ('usdt', 'eth', etc.)
function normalizeAsset(payCurrency: string): string {
    const c = (payCurrency || '').toLowerCase().trim();
    if (c.startsWith('usdt')) return 'usdt';
    if (c.startsWith('usdc')) return 'usdc';
    if (c.startsWith('eth')) return 'eth';
    if (c.startsWith('bnb')) return 'bnb';
    if (c.startsWith('btc')) return 'btc';
    if (c.startsWith('sol')) return 'sol';
    if (c.startsWith('trx')) return 'trx';
    if (c.startsWith('ton')) return 'ton';
    return c;
}

// Deep sort keys for NowPayments HMAC verification without converting arrays to objects
function sortObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj;
    }
    return Object.keys(obj).sort().reduce((result: any, key: string) => {
        result[key] = sortObject(obj[key]);
        return result;
    }, {});
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const signature = req.headers.get('x-nowpayments-sig');
        const rawBody = await req.text();

        if (!rawBody) {
            return new Response("Empty payload", { status: 400, headers: corsHeaders });
        }

        let eventData: any;
        try {
            eventData = JSON.parse(rawBody);
        } catch {
            return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
        }

        console.log(`[Crypto Webhook Received] status=${eventData.payment_status}, id=${eventData.payment_id}, paid=${eventData.actually_paid}, currency=${eventData.pay_currency}`);

        // 1. Fetch IPN Secret Key
        let ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET') || Deno.env.get('NOWPAYMENTS_SECRET') || Deno.env.get('NOW_PAYMENTS_IPN_SECRET');
        if (!ipnSecret) {
            const { data: secrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', ['NOWPAYMENTS_IPN_SECRET', 'NOWPAYMENTS_SECRET', 'NOW_PAYMENTS_IPN_SECRET']);

            if (secrets && secrets.length > 0) {
                const found = secrets.find(s => s.value && s.value.trim().length > 0);
                if (found) ipnSecret = found.value.trim();
            }
        }

        // 2. Signature Verification (if IPN secret configured)
        if (ipnSecret && signature) {
            const sortedData = sortObject(eventData);
            const signString = JSON.stringify(sortedData);

            const encoder = new TextEncoder();
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                encoder.encode(ipnSecret),
                { name: 'HMAC', hash: 'SHA-512' },
                false,
                ['sign']
            );
            const signatureBuffer = await crypto.subtle.sign(
                'HMAC',
                cryptoKey,
                encoder.encode(signString)
            );
            const signatureArray = Array.from(new Uint8Array(signatureBuffer));
            const expectedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

            if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
                console.error("[Crypto Webhook] Signature mismatch! Check NOWPAYMENTS_IPN_SECRET.");
                // If signature fails in production, abort
                return new Response("Invalid signature", { status: 401, headers: corsHeaders });
            }
            console.log("[Crypto Webhook] Signature verified successfully.");
        } else if (!signature) {
            console.warn("[Crypto Webhook] Warning: x-nowpayments-sig header missing from request.");
        }

        // 3. Status Handling: Finished, Confirmed, or Partially Paid
        // NowPayments statuses: 'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired'
        const validStatuses = ['finished', 'confirmed', 'partially_paid'];
        const isFundedStatus = validStatuses.includes(eventData.payment_status);

        if (!isFundedStatus) {
            console.log(`[Crypto Webhook] Non-credit status: ${eventData.payment_status}. Event logged.`);
            return new Response(JSON.stringify({ status: "Pending or Ignored", code: eventData.payment_status }), { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        const paymentId = String(eventData.payment_id);
        const amountReceived = parseFloat(eventData.actually_paid || eventData.pay_amount || eventData.outcome_amount || '0');
        const assetName = normalizeAsset(eventData.pay_currency || eventData.outcome_currency || 'usdt');

        if (isNaN(amountReceived) || amountReceived <= 0) {
            console.warn(`[Crypto Webhook] Received status ${eventData.payment_status} but actually_paid is ${amountReceived}.`);
            return new Response("Amount zero or invalid", { status: 200, headers: corsHeaders });
        }

        // 4. Multi-tier User Resolution
        let userId: string | null = null;
        let matchedAddress: string | null = eventData.pay_address || null;

        // Method A: Check order_id pattern 'crypto_dep_${userId}_${timestamp}'
        if (eventData.order_id && typeof eventData.order_id === 'string') {
            const match = eventData.order_id.match(/^crypto_dep_([0-9a-fA-F-]{36})/);
            if (match && match[1]) {
                userId = match[1];
                console.log(`[Crypto Webhook] User resolved from order_id: ${userId}`);
            }
        }

        // Method B: Check crypto_addresses by payment_id
        if (!userId && paymentId) {
            const { data: addressData } = await supabaseAdmin
                .from('crypto_addresses')
                .select('user_id, address')
                .eq('payment_id', paymentId)
                .maybeSingle();

            if (addressData?.user_id) {
                userId = addressData.user_id;
                matchedAddress = addressData.address || matchedAddress;
                console.log(`[Crypto Webhook] User resolved from payment_id: ${userId}`);
            }
        }

        // Method C: Check crypto_addresses by wallet address
        if (!userId && eventData.pay_address) {
            const { data: addressData } = await supabaseAdmin
                .from('crypto_addresses')
                .select('user_id, address')
                .ilike('address', eventData.pay_address.trim())
                .maybeSingle();

            if (addressData?.user_id) {
                userId = addressData.user_id;
                matchedAddress = addressData.address;
                console.log(`[Crypto Webhook] User resolved from pay_address: ${userId}`);
            }
        }

        // Method D: Check by parent_payment_id if available
        if (!userId && eventData.parent_payment_id) {
            const { data: addressData } = await supabaseAdmin
                .from('crypto_addresses')
                .select('user_id, address')
                .eq('payment_id', String(eventData.parent_payment_id))
                .maybeSingle();

            if (addressData?.user_id) {
                userId = addressData.user_id;
                matchedAddress = addressData.address || matchedAddress;
                console.log(`[Crypto Webhook] User resolved from parent_payment_id: ${userId}`);
            }
        }

        if (!userId) {
            console.error(`[Crypto Webhook] User could not be resolved for payment_id=${paymentId}, address=${eventData.pay_address}, order_id=${eventData.order_id}`);
            // Log into payment_events anyway for audit / manual recovery
            await supabaseAdmin.from('payment_events').insert({
                reference: paymentId,
                amount: amountReceived,
                provider: 'nowpayments',
                currency: assetName,
                status: 'unresolved_user',
                metadata: { metadata: eventData, error: 'User could not be linked' }
            });
            return new Response("User not found, event logged", { status: 200, headers: corsHeaders });
        }

        // 5. Delta Crediting & Idempotency
        const { data: existingEvent } = await supabaseAdmin
            .from('payment_events')
            .select('id, amount, status')
            .eq('reference', paymentId)
            .maybeSingle();

        const previousCredited = existingEvent ? (Number(existingEvent.amount) || 0) : 0;
        const deltaToCredit = amountReceived - previousCredited;

        if (deltaToCredit <= 0) {
            console.log(`[Crypto Webhook] Payment ${paymentId} already credited ${previousCredited} (current paid: ${amountReceived}). Skipping.`);
            return new Response(JSON.stringify({ status: "Already credited", payment_id: paymentId }), { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        console.log(`[Crypto Webhook] Crediting user ${userId}: +${deltaToCredit} ${assetName.toUpperCase()} (Total paid: ${amountReceived})`);

        // 6. Credit Crypto Wallet Balance
        const { data: newBalance, error: updateError } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: userId,
            asset: assetName,
            amount: deltaToCredit
        });

        if (updateError) {
            console.error("[Crypto Webhook] Balance Update Error:", updateError);
            return new Response("Error updating balance", { status: 500, headers: corsHeaders });
        }

        // 7. Record Transaction, Payment Event, and In-App Notification
        const formattedAmount = `${deltaToCredit} ${assetName.toUpperCase()}`;
        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: userId,
                type: 'crypto_deposit',
                amount: deltaToCredit,
                status: 'success',
                reference: paymentId,
                description: `Crypto Deposit: +${formattedAmount} (${eventData.payment_status})`
            }),
            existingEvent
                ? supabaseAdmin.from('payment_events').update({
                    amount: amountReceived,
                    status: eventData.payment_status,
                    metadata: { metadata: eventData, updated_at: new Date().toISOString() }
                }).eq('id', existingEvent.id)
                : supabaseAdmin.from('payment_events').insert({
                    reference: paymentId,
                    amount: amountReceived,
                    provider: 'nowpayments',
                    currency: assetName,
                    status: eventData.payment_status,
                    metadata: { metadata: eventData }
                })
        ]);

        // 8. Dispatch Realtime Push, Email & In-App Notification
        await notifyCryptoUser({
            supabaseAdmin,
            userId,
            type: 'crypto_deposit',
            title: 'Crypto Deposit Credited 💰',
            body: `Your deposit of +${formattedAmount} has been confirmed on the blockchain and credited to your wallet!`,
            amount: deltaToCredit,
            asset: assetName,
            reference: paymentId,
            recipientOrAddress: matchedAddress || undefined,
            extraData: {
                status: eventData.payment_status,
                network: eventData.network || undefined
            }
        });

        console.log(`[Crypto Webhook SUCCESS] User ${userId} credited with ${formattedAmount}. New balance:`, newBalance);

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Wallet Funded", 
            credited: deltaToCredit,
            asset: assetName 
        }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error: any) {
        console.error("[Crypto Webhook Exception]:", error);
        return new Response(JSON.stringify({ error: error.message || "Internal processing failure" }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
});

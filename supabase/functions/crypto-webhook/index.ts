import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const signature = req.headers.get('x-nowpayments-sig');
        if (!signature) {
            return new Response("Missing signature", { status: 401 });
        }

        const rawBody = await req.text();
        
        let NOWPAYMENTS_IPN_SECRET = Deno.env.get('NOWPAYMENTS_IPN_SECRET');
        if (!NOWPAYMENTS_IPN_SECRET) {
            const { data: secret } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'NOWPAYMENTS_IPN_SECRET').maybeSingle();
            if (secret && secret.value) NOWPAYMENTS_IPN_SECRET = secret.value;
        }

        if (!NOWPAYMENTS_IPN_SECRET) {
            console.error("[CRITICAL] NOWPAYMENTS_IPN_SECRET not set");
            return new Response("Provider Config Error", { status: 500 });
        }

        // Verify signature
        // Sort keys and stringify exactly as NowPayments expects
        const eventData = JSON.parse(rawBody);
        
        const sortObject = (obj: any): any => {
            return Object.keys(obj).sort().reduce((result: any, key: string) => {
                result[key] = (obj[key] && typeof obj[key] === 'object') ? sortObject(obj[key]) : obj[key];
                return result;
            }, {});
        };

        const sortedData = sortObject(eventData);
        const signString = JSON.stringify(sortedData);
        
        // Use native Web Crypto API for HMAC SHA-512
        const encoder = new TextEncoder();
        const keyData = encoder.encode(NOWPAYMENTS_IPN_SECRET);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
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

        if (signature !== expectedSignature) {
            console.error("Invalid NowPayments signature match");
            return new Response("Invalid signature", { status: 401 });
        }

        console.log("=== NEW CRYPTO WEBHOOK ===", eventData.payment_status);

        // NowPayments statuses: 'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired'
        if (eventData.payment_status === 'finished' || eventData.payment_status === 'confirmed') {
            
            const paymentId = String(eventData.payment_id);
            const amountReceived = parseFloat(eventData.actually_paid || eventData.pay_amount);
            const currencyReceived = eventData.pay_currency;
            
            // 1. Find the user associated with this payment address/id
            const { data: addressData, error: addressError } = await supabaseAdmin
                .from('crypto_addresses')
                .select('user_id')
                .eq('payment_id', paymentId)
                .maybeSingle();

            if (!addressData || addressError) {
                console.error("User not found for payment_id:", paymentId);
                return new Response("User not found", { status: 200 });
            }

            const userId = addressData.user_id;

            // 2. Check Idempotency
            const { data: existing, error: checkError } = await supabaseAdmin
                .from('payment_events')
                .select('reference')
                .eq('reference', paymentId)
                .maybeSingle();

            if (existing) {
                console.log(`Duplicate Event Ignored: ${paymentId}`);
                return new Response("Already Processed", { status: 200 });
            }

            // 3. Get the Crypto Amount
            const creditAmount = parseFloat(eventData.actually_paid || eventData.pay_amount);
            const assetName = currencyReceived.toLowerCase();

            // 4. Fund Crypto Wallet
            const { data: newBalance, error: updateError } = await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: userId,
                asset: assetName,
                amount: creditAmount
            });

            if (updateError) {
                console.error("Balance Update Error:", updateError);
                return new Response("Error updating balance", { status: 500 });
            }

            // 5. Record Transaction
            await Promise.all([
                supabaseAdmin.from('transactions').insert({
                    user_id: userId,
                    type: 'crypto_deposit',
                    amount: creditAmount,
                    status: 'success',
                    reference: paymentId,
                    description: `Crypto Deposit: ${creditAmount} ${assetName.toUpperCase()}`
                }),
                supabaseAdmin.from('payment_events').insert({
                    reference: paymentId,
                    amount: creditAmount,
                    provider: 'nowpayments',
                    currency: assetName,
                    status: 'completed',
                    metadata: { metadata: eventData }
                })
            ]);

            return new Response("Wallet Funded", { status: 200 });
        }

        return new Response("Event Ignored", { status: 200 });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return new Response(JSON.stringify({ error: "Internal processing failure" }), { status: 500 });
    }
});

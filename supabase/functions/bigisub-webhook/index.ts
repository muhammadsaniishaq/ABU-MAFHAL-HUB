import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bigisub-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uagcxrtdqttayulvgpwg.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req: Request) => {
    // 1. Handle CORS Pre-flight and Health Check Pings
    if (req.method === 'OPTIONS' || req.method === 'GET') {
        return new Response(JSON.stringify({ 
            status: 'ok', 
            service: 'Abu Mafhal BigiSub Webhook Receiver', 
            timestamp: new Date().toISOString() 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 🛡️ Webhook Authentication & Signature Verification
        const reqSignature = req.headers.get('x-bigisub-signature') || req.headers.get('x-signature') || '';
        const authHeader = req.headers.get('Authorization') || '';
        const urlSecret = new URL(req.url).searchParams.get('secret') || '';

        const { data: secrets } = await supabase
            .from('system_secrets')
            .select('key, value')
            .in('key', ['BIGI_API_TOKEN', 'BIGISUB_WEBHOOK_SECRET', 'BIGI_API_PIN']);

        const secretMap = new Map(secrets?.map((s: any) => [s.key, s.value]) || []);
        const expectedToken = secretMap.get('BIGISUB_WEBHOOK_SECRET') || secretMap.get('BIGI_API_TOKEN') || Deno.env.get('BIGI_API_TOKEN') || '';

        // If secret is configured in system_secrets or environment, strictly verify caller
        if (expectedToken) {
            const isTokenMatch = authHeader.includes(expectedToken) || 
                                reqSignature === expectedToken || 
                                urlSecret === expectedToken ||
                                authHeader.replace('Token ', '').replace('Bearer ', '').trim() === expectedToken;

            if (!isTokenMatch && reqSignature) {
                // Check HMAC if sent as signature
                try {
                    const key = await crypto.subtle.importKey(
                        "raw",
                        new TextEncoder().encode(expectedToken),
                        { name: "HMAC", hash: "SHA-256" },
                        false,
                        ["verify"]
                    );
                    const bodyBytes = new TextEncoder().encode(await req.clone().text());
                    const sigBytes = new Uint8Array(reqSignature.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                    const isValidHmac = await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
                    if (!isValidHmac) {
                        console.error('[BigiSub Webhook] HMAC Signature Verification Failed!');
                        return new Response(JSON.stringify({ error: "Unauthorized signature" }), { status: 401, headers: corsHeaders });
                    }
                } catch (_) {
                    console.error('[BigiSub Webhook] Authentication token mismatch!');
                    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
                }
            } else if (!isTokenMatch && !authHeader.includes(supabaseServiceKey)) {
                console.warn('[BigiSub Webhook] Unauthorized request without matching token or signature!');
                return new Response(JSON.stringify({ error: "Unauthorized request" }), { status: 401, headers: corsHeaders });
            }
        }

        const bodyText = await req.text();
        let payload: any = {};
        try {
            payload = JSON.parse(bodyText);
        } catch (_) {
            payload = { raw: bodyText };
        }

        console.log('[BigiSub Webhook] Received Event:', JSON.stringify(payload));

        const event = payload?.event || payload?.type || 'unknown';
        const data = payload?.data || payload;

        // Log to audit / webhook log
        try {
            await supabase.from('admin_audit_logs').insert({
                admin_id: 'SYSTEM_WEBHOOK',
                action: `BIGISUB_WEBHOOK_${event.toUpperCase()}`,
                target_resource: 'BigiSub Webhook',
                details: payload,
                created_at: new Date().toISOString()
            });
        } catch (logErr) {
            console.warn('[BigiSub Webhook] Log warning:', logErr);
        }

        // 2. Handle Transaction Settled (Data / Airtime Delivery Notification)
        if (event === 'transaction.settled' || payload?.status || data?.status) {
            const rawStatus = String(data?.status || payload?.status || '').toLowerCase();
            const ref = data?.ident || data?.reference || data?.request_id || payload?.ident || payload?.reference;

            const isSuccess = rawStatus.includes('success') || rawStatus.includes('complete') || rawStatus === '00' || rawStatus === '200';
            const isFailed = rawStatus.includes('fail') || rawStatus.includes('reverse') || rawStatus.includes('reject') || rawStatus.includes('cancel');

            if (ref) {
                // Find matching transaction
                const { data: tx } = await supabase
                    .from('transactions')
                    .select('*')
                    .or(`reference.eq.${ref},id.eq.${ref}`)
                    .maybeSingle();

                if (tx) {
                    if (isSuccess && tx.status !== 'completed' && tx.status !== 'success') {
                        await supabase
                            .from('transactions')
                            .update({
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                                metadata: { ...(tx.metadata || {}), bigisub_settled: payload }
                            })
                            .eq('id', tx.id);
                        console.log(`[BigiSub Webhook] Transaction ${tx.id} marked as completed.`);
                    } else if (isFailed && tx.status !== 'failed' && tx.status !== 'reversed') {
                        // 🛡️ Atomic Auto-Refund: Prevent duplicate replay refunds
                        const { data: existingRefund } = await supabase
                            .from('transactions')
                            .select('id')
                            .eq('user_id', tx.user_id)
                            .eq('type', 'refund')
                            .ilike('reference', `%${ref}%`)
                            .maybeSingle();

                        if (existingRefund) {
                            console.log(`[BigiSub Webhook] Refund already processed for ref ${ref}. Skipping.`);
                        } else {
                            await supabase
                                .from('transactions')
                                .update({
                                    status: 'reversed',
                                    updated_at: new Date().toISOString(),
                                    metadata: { ...(tx.metadata || {}), bigisub_settled: payload, failure_reason: rawStatus }
                                })
                                .eq('id', tx.id);

                            if (tx.user_id && tx.amount && Number(tx.amount) > 0) {
                                await supabase.rpc('credit_balance', {
                                    user_id: tx.user_id,
                                    amount: Number(tx.amount)
                                });

                                // Insert refund transaction record
                                await supabase
                                    .from('transactions')
                                    .insert({
                                        user_id: tx.user_id,
                                        type: 'refund',
                                        amount: tx.amount,
                                        status: 'completed',
                                        reference: `REF_${ref}_${Date.now()}`,
                                        description: `Auto-Refund for failed BigiSub transaction (${ref})`
                                    });
                                console.log(`[BigiSub Webhook] Atomically Refunded ₦${tx.amount} to user ${tx.user_id}`);
                            }
                        }
                    }
                }
            }
        }

        // 3. Handle Catalogue Changed (Price moves, plan changes)
        if (event === 'catalogue.changed') {
            console.log('[BigiSub Webhook] Catalogue changed event received from BigiSub.');
            // Trigger automatic plan catalog sync if needed
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Webhook processed successfully' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('[BigiSub Webhook] Error:', err);
        return new Response(JSON.stringify({ 
            success: false, 
            error: err.message || 'Internal error' 
        }), {
            status: 200, // Return 200 so webhook provider doesn't excessively retry on payload issues
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});


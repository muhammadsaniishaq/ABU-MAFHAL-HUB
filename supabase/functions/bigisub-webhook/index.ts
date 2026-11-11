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
        const bodyText = await req.text();
        let payload: any = {};
        try {
            payload = JSON.parse(bodyText);
        } catch (_) {
            payload = { raw: bodyText };
        }

        console.log('[BigiSub Webhook] Received Event:', JSON.stringify(payload));

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
                        // If transaction failed at BigiSub and user balance was charged, refund them safely
                        await supabase
                            .from('transactions')
                            .update({
                                status: 'failed',
                                updated_at: new Date().toISOString(),
                                metadata: { ...(tx.metadata || {}), bigisub_settled: payload, failure_reason: rawStatus }
                            })
                            .eq('id', tx.id);

                        if (tx.user_id && tx.amount && Number(tx.amount) > 0 && tx.type === 'payment') {
                            const { data: prof } = await supabase
                                .from('profiles')
                                .select('balance')
                                .eq('id', tx.user_id)
                                .maybeSingle();

                            if (prof) {
                                const newBal = Number(prof.balance || 0) + Number(tx.amount);
                                await supabase
                                    .from('profiles')
                                    .update({ balance: newBal })
                                    .eq('id', tx.user_id);

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
                                console.log(`[BigiSub Webhook] Refunded ₦${tx.amount} to user ${tx.user_id}`);
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


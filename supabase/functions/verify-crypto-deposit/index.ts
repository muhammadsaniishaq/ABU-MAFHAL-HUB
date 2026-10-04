import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

        const body = await req.json().catch(() => ({}));
        let { payment_id, address, currency } = body;

        // If payment_id not provided directly, lookup from user's crypto_addresses
        if (!payment_id && address) {
            const { data: addrRec } = await supabaseAdmin
                .from('crypto_addresses')
                .select('payment_id')
                .eq('user_id', user.id)
                .ilike('address', address.trim())
                .maybeSingle();

            if (addrRec && addrRec.payment_id) {
                payment_id = addrRec.payment_id;
            }
        }

        // If still no payment_id, fetch latest active crypto_address for user
        if (!payment_id) {
            let q = supabaseAdmin
                .from('crypto_addresses')
                .select('payment_id, address, currency')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (currency) {
                q = q.ilike('currency', currency.toLowerCase().trim());
            }

            const { data: latestAddr } = await q.maybeSingle();
            if (latestAddr && latestAddr.payment_id) {
                payment_id = latestAddr.payment_id;
                if (!address) address = latestAddr.address;
            }
        }

        if (!payment_id) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "No active deposit invoice or payment ID found. Please generate a deposit address first." 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Fetch NowPayments API Key (env → system_secrets → app_settings)
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY') || Deno.env.get('NOWPAYMENTS_KEY');
        if (!NOWPAYMENTS_API_KEY) {
            const { data: secrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', [
                    'NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_KEY',
                    'nowpayments_api_key', 'nowpayments_key',
                    'NOWPAYMENTS_TOKEN', 'nowpayments_token'
                ]);

            if (secrets && secrets.length > 0) {
                const found = secrets.find(s => s.value && s.value.trim().length > 0);
                if (found) NOWPAYMENTS_API_KEY = found.value.trim();
            }
        }

        if (!NOWPAYMENTS_API_KEY) {
            const { data: appSetting } = await supabaseAdmin
                .from('app_settings')
                .select('value')
                .in('key', ['NOWPAYMENTS_API_KEY', 'nowpayments_api_key', 'nowpayments_token'])
                .maybeSingle();
            if (appSetting?.value) {
                NOWPAYMENTS_API_KEY = typeof appSetting.value === 'string'
                    ? appSetting.value.trim()
                    : (appSetting.value.key || appSetting.value.api_key || '');
            }
        }

        if (!NOWPAYMENTS_API_KEY) {
            throw new Error('NowPayments gateway is not configured. Set NOWPAYMENTS_API_KEY in Admin Vault.');
        }

        // Query NowPayments API for this payment
        const npRes = await fetch(`https://api.nowpayments.io/v1/payment/${payment_id}`, {
            headers: { 'x-api-key': NOWPAYMENTS_API_KEY }
        });

        if (!npRes.ok) {
            const errData = await npRes.json().catch(() => ({}));
            throw new Error(errData.message || `Provider lookup failed with status ${npRes.status}`);
        }

        const payment = await npRes.json();
        console.log(`[Verify Deposit Check] id=${payment_id}, status=${payment.payment_status}, paid=${payment.actually_paid}`);

        const validStatuses = ['finished', 'confirmed', 'partially_paid'];
        const isFunded = validStatuses.includes(payment.payment_status);
        const amountReceived = parseFloat(payment.actually_paid || payment.pay_amount || payment.outcome_amount || '0');
        const assetName = normalizeAsset(payment.pay_currency || payment.outcome_currency || 'usdt');

        if (!isFunded || isNaN(amountReceived) || amountReceived <= 0) {
            return new Response(JSON.stringify({
                success: false,
                pending: true,
                status: payment.payment_status || 'waiting',
                payment_id: String(payment_id),
                message: payment.payment_status === 'waiting'
                    ? "Awaiting your payment on the blockchain. If you just sent it, please wait a minute for block confirmations."
                    : payment.payment_status === 'confirming'
                    ? "Payment detected on blockchain! Confirming blocks..."
                    : payment.payment_status === 'expired'
                    ? "This invoice has expired on the payment gateway. Please tap 'Generate Fresh Address' to get an active address."
                    : payment.payment_status === 'failed'
                    ? "Payment marked as failed by gateway. Please tap 'Generate Fresh Address' to try again."
                    : `Payment status: ${payment.payment_status}`
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check if already credited in payment_events
        const { data: existingEvent } = await supabaseAdmin
            .from('payment_events')
            .select('id, amount, status')
            .eq('reference', String(payment_id))
            .maybeSingle();

        const previousCredited = existingEvent ? (Number(existingEvent.amount) || 0) : 0;
        const deltaToCredit = amountReceived - previousCredited;

        if (deltaToCredit <= 0) {
            return new Response(JSON.stringify({
                success: true,
                alreadyCredited: true,
                status: payment.payment_status,
                payment_id: String(payment_id),
                amount: previousCredited,
                asset: assetName,
                message: `Deposit of ${previousCredited} ${assetName.toUpperCase()} has already been credited to your wallet.`
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Credit wallet
        const { data: newBal, error: creditErr } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: user.id,
            asset: assetName,
            amount: deltaToCredit
        });

        if (creditErr) {
            throw new Error(`Failed to credit balance: ${creditErr.message}`);
        }

        const formattedAmount = `${deltaToCredit} ${assetName.toUpperCase()}`;

        // Record transactions, event, and in-app alert
        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_deposit',
                amount: deltaToCredit,
                status: 'success',
                reference: String(payment_id),
                description: `Crypto Deposit: +${formattedAmount} (${payment.payment_status})`
            }),
            existingEvent
                ? supabaseAdmin.from('payment_events').update({
                    amount: amountReceived,
                    status: payment.payment_status,
                    metadata: { metadata: payment, verified_at: new Date().toISOString() }
                }).eq('id', existingEvent.id)
                : supabaseAdmin.from('payment_events').insert({
                    reference: String(payment_id),
                    amount: amountReceived,
                    provider: 'nowpayments',
                    currency: assetName,
                    status: payment.payment_status,
                    metadata: { metadata: payment }
                })
        ]);

        // Dispatch Realtime Push, Email & In-App Notification
        await notifyCryptoUser({
            supabaseAdmin,
            userId: user.id,
            type: 'crypto_deposit',
            title: 'Crypto Deposit Verified & Credited 💰',
            body: `Your deposit of +${formattedAmount} has been verified and credited to your wallet!`,
            amount: deltaToCredit,
            asset: assetName,
            reference: String(payment_id),
            recipientOrAddress: payment.pay_address || address || undefined,
            extraData: {
                status: payment.payment_status
            }
        });

        return new Response(JSON.stringify({
            success: true,
            credited: deltaToCredit,
            asset: assetName,
            status: payment.payment_status,
            payment_id: String(payment_id),
            message: `Success! ${formattedAmount} has been credited to your wallet.`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Verify Crypto Deposit Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Verification failed' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

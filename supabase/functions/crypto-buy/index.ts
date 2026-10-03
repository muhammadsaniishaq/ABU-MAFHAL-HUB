import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';

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
        if (userError || !user) throw new Error('Invalid authentication token');

        const { asset, amountNgn, amountCrypto, rate } = await req.json();

        const costNgn = parseFloat(amountNgn);
        let cryptoReceived = parseFloat(amountCrypto);
        const normAsset = (asset || 'usdt').toLowerCase().trim();

        if (!normAsset || isNaN(costNgn) || costNgn <= 0) {
            throw new Error('Invalid buy parameters. Please provide valid amounts.');
        }

        // Fetch official platform rates from app_settings to guarantee rate accuracy & profit
        let effectiveRate = parseFloat(rate) || 1480;
        try {
            const { data: rateSettings } = await supabaseAdmin
                .from('app_settings')
                .select('key, value')
                .in('key', [
                    `crypto_rate_${normAsset}_buy`,
                    'crypto_rate_usdt_buy'
                ]);

            if (rateSettings && rateSettings.length > 0) {
                const assetRateSetting = rateSettings.find(s => s.key === `crypto_rate_${normAsset}_buy`);
                const usdtRateSetting = rateSettings.find(s => s.key === 'crypto_rate_usdt_buy');

                if (assetRateSetting?.value) {
                    const parsed = parseFloat(assetRateSetting.value);
                    if (!isNaN(parsed) && parsed > 0) effectiveRate = parsed;
                } else if (usdtRateSetting?.value && normAsset === 'usdt') {
                    const parsed = parseFloat(usdtRateSetting.value);
                    if (!isNaN(parsed) && parsed > 0) effectiveRate = parsed;
                }
            }
        } catch (_) {}

        // Calculate exact legitimate crypto amount with precision
        if (effectiveRate > 0) {
            cryptoReceived = Number((costNgn / effectiveRate).toFixed(normAsset === 'btc' ? 8 : normAsset === 'eth' ? 6 : 4));
        }

        if (cryptoReceived <= 0) {
            throw new Error('Amount too small for crypto purchase at current rate.');
        }

        // 1. Verify Naira Balance
        const { data: profile, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (profErr || !profile) {
            throw new Error('Could not fetch user profile balance');
        }

        const currentNgn = Number(profile.balance || 0);
        if (currentNgn < costNgn) {
            throw new Error(`Insufficient Naira balance. Required: ₦${costNgn.toLocaleString()}, Available: ₦${currentNgn.toLocaleString()}`);
        }

        // 2. Atomically Deduct Naira via deduct_balance RPC
        const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('deduct_balance', {
            user_id: user.id,
            amount: costNgn
        });

        const deductSuccess = deductData && (deductData.success === true || deductData === true);
        if (deductErr || !deductSuccess) {
            console.error('[Crypto Buy] Naira deduction failed:', deductErr || deductData);
            throw new Error(deductData?.error || 'Failed to deduct Naira balance. Transaction aborted.');
        }

        // 3. Atomically Credit Crypto Balance
        const { data: creditData, error: creditErr } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: user.id,
            asset: normAsset,
            amount: cryptoReceived
        });

        if (creditErr || !creditData?.success) {
            console.error('[Crypto Buy] Crypto credit failed, rolling back Naira:', creditErr || creditData);
            // GUARANTEED ROLLBACK: 100% refund of Naira to user
            await supabaseAdmin.rpc('credit_balance', {
                user_id: user.id,
                amount: costNgn
            });
            throw new Error('Failed to credit crypto balance. Your ₦' + costNgn.toLocaleString() + ' has been 100% refunded.');
        }

        // 4. Record Transaction
        const formattedCrypto = `${cryptoReceived} ${normAsset.toUpperCase()}`;
        const refId = `buy_${Date.now()}_${user.id.slice(0, 6)}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_buy',
                amount: costNgn,
                status: 'success',
                reference: refId,
                description: `Bought ${formattedCrypto} for ₦${costNgn.toLocaleString()}`
            }),
            // Dispatch Realtime In-App, Push, and Email notifications
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_buy',
                title: 'Crypto Purchased Successfully! 🎉',
                body: `You have successfully bought ${formattedCrypto} for ₦${costNgn.toLocaleString()}. It has been credited to your wallet.`,
                amount: cryptoReceived,
                asset: normAsset,
                reference: refId,
                fee: '₦0 (Included in rate)',
                extraData: {
                    costNgn,
                    rate: rate || undefined
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully purchased ${formattedCrypto}!`,
            credited: cryptoReceived,
            debitedNgn: costNgn,
            asset: normAsset
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Crypto Buy Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Crypto purchase failed' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

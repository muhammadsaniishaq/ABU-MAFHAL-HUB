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

        const { asset, amountCrypto, expectedNgn, rate } = await req.json();

        const cryptoToSell = parseFloat(amountCrypto);
        let ngnToReceive = parseFloat(expectedNgn);
        const normAsset = (asset || 'usdt').toLowerCase().trim();

        if (!normAsset || isNaN(cryptoToSell) || cryptoToSell <= 0) {
            throw new Error('Invalid sell parameters. Please specify valid amounts.');
        }

        // Fetch official platform sell rates to guarantee platform profit
        let effectiveSellRate = parseFloat(rate) || 1460;
        try {
            const { data: rateSettings } = await supabaseAdmin
                .from('app_settings')
                .select('key, value')
                .in('key', [
                    `crypto_rate_${normAsset}_sell`,
                    'crypto_rate_usdt_sell'
                ]);

            if (rateSettings && rateSettings.length > 0) {
                const assetSellSetting = rateSettings.find(s => s.key === `crypto_rate_${normAsset}_sell`);
                const usdtSellSetting = rateSettings.find(s => s.key === 'crypto_rate_usdt_sell');

                if (assetSellSetting?.value) {
                    const parsed = parseFloat(assetSellSetting.value);
                    if (!isNaN(parsed) && parsed > 0) effectiveSellRate = parsed;
                } else if (usdtSellSetting?.value && normAsset === 'usdt') {
                    const parsed = parseFloat(usdtSellSetting.value);
                    if (!isNaN(parsed) && parsed > 0) effectiveSellRate = parsed;
                }
            }
        } catch (_) {}

        if (effectiveSellRate > 0) {
            ngnToReceive = Math.floor(cryptoToSell * effectiveSellRate);
        }

        if (ngnToReceive <= 0) {
            throw new Error('Sell amount too small to generate Naira payout.');
        }

        // 1. Verify Crypto Balance
        const { data: balRecord, error: balErr } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', normAsset)
            .maybeSingle();

        const currentCryptoBal = Number(balRecord?.balance || 0);
        if (balErr || currentCryptoBal < cryptoToSell) {
            throw new Error(`Insufficient ${normAsset.toUpperCase()} balance. Required: ${cryptoToSell}, Available: ${currentCryptoBal}`);
        }

        // 2. Atomically Deduct Crypto Balance
        const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: normAsset,
            amount: cryptoToSell
        });

        if (deductErr || !deductData?.success) {
            console.error('[Crypto Sell] Crypto deduction error:', deductErr || deductData);
            throw new Error(deductData?.error || 'Failed to safely reserve crypto for sale. Transaction aborted.');
        }

        // 3. Atomically Credit Naira via credit_balance RPC
        const { data: creditNgnData, error: creditNgnErr } = await supabaseAdmin.rpc('credit_balance', {
            user_id: user.id,
            amount: ngnToReceive
        });

        const creditSuccess = creditNgnData && (creditNgnData.success === true || creditNgnData === true);
        if (creditNgnErr || !creditSuccess) {
            console.error('[Crypto Sell] Naira credit failed, rolling back crypto:', creditNgnErr || creditNgnData);
            // GUARANTEED ROLLBACK: 100% refund of crypto to user
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: normAsset,
                amount: cryptoToSell
            });
            throw new Error('Failed to credit Naira balance. Your ' + cryptoToSell + ' ' + normAsset.toUpperCase() + ' has been 100% refunded.');
        }

        // 4. Record Transaction
        const formattedCrypto = `${cryptoToSell} ${normAsset.toUpperCase()}`;
        const refId = `sell_${Date.now()}_${user.id.slice(0, 6)}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_sell',
                amount: ngnToReceive,
                status: 'success',
                reference: refId,
                description: `Sold ${formattedCrypto} for ₦${ngnToReceive.toLocaleString()}`
            }),
            // Dispatch Realtime In-App, Push, and Email notifications
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_sell',
                title: 'Crypto Sold & Naira Credited! 💵',
                body: `You have successfully sold ${formattedCrypto} for ₦${ngnToReceive.toLocaleString()}. Funds are now in your wallet balance.`,
                amount: ngnToReceive,
                asset: 'NGN',
                reference: refId,
                extraData: {
                    cryptoSold: cryptoToSell,
                    asset: normAsset,
                    rate: rate || undefined
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully sold ${formattedCrypto} for ₦${ngnToReceive.toLocaleString()}!`,
            debitedCrypto: cryptoToSell,
            creditedNgn: ngnToReceive,
            asset: normAsset
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Crypto Sell Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Crypto sale failed' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

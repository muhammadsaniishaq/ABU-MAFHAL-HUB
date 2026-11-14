import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';
import {
    validateUserSecurity,
    checkCryptoMaintenance,
    validateAsset,
    validateAmount,
    getAuthoritativeCryptoRates
} from '../_shared/crypto-security.ts';

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
        if (userError || !user) throw new Error('Zaman ku ya kare ko ba ku da izini. Da fatan a sake shiga.');

        // 🛡️ 1. Security Shields: User Profile Ban/Suspension & Global Maintenance Mode
        await validateUserSecurity(supabaseAdmin, user.id);
        await checkCryptoMaintenance(supabaseAdmin);

        const body = await req.json();
        const { asset, amountCrypto } = body;

        // 🛡️ 2. Asset & Amount Validation
        const normAsset = validateAsset(asset);
        const cryptoToSell = validateAmount(amountCrypto, 0.00000001, 1_000_000);

        // 🛡️ 3. Authoritative Sell Rate Enforcement (Server-Enforced Only)
        const authoritativeRates = await getAuthoritativeCryptoRates(supabaseAdmin);
        const effectiveSellRate = authoritativeRates.getSellRateNgn(normAsset);

        const ngnToReceive = Math.floor(cryptoToSell * effectiveSellRate);
        if (ngnToReceive < 100) {
            throw new Error('Adadin crypto da kake son sayarwa ya yi kadan don biyan Naira.');
        }

        // 🛡️ 4. Server-Side Crypto Balance Verification
        const { data: balRecord, error: balErr } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', normAsset)
            .maybeSingle();

        const currentCryptoBal = Number(balRecord?.balance || 0);
        if (balErr || currentCryptoBal < cryptoToSell) {
            throw new Error(`Crypto din da ke asusunka bai isa ba. Ana buƙatar: ${cryptoToSell} ${normAsset.toUpperCase()}, amma kana da: ${currentCryptoBal} ${normAsset.toUpperCase()}`);
        }

        // 🛡️ 5. Atomic Crypto Deduction
        const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: normAsset,
            amount: cryptoToSell
        });

        if (deductErr || !deductData?.success) {
            console.error('[Crypto Sell] Crypto deduction error:', deductErr || deductData);
            throw new Error(deductData?.error || 'Kasa cire crypto daga asusunka. An dakatar da cinikin.');
        }

        // 🛡️ 6. Atomic Naira Crediting with Fail-Safe Rollback
        const { data: creditNgnData, error: creditNgnErr } = await supabaseAdmin.rpc('credit_balance', {
            user_id: user.id,
            amount: ngnToReceive
        });

        const creditSuccess = !creditNgnErr && (
            typeof creditNgnData === 'number' ||
            !isNaN(Number(creditNgnData)) ||
            (typeof creditNgnData === 'object' && creditNgnData !== null && creditNgnData.success === true) ||
            creditNgnData === true
        );

        if (creditNgnErr || !creditSuccess) {
            console.error('[Crypto Sell] Naira credit failed, rolling back crypto:', creditNgnErr || creditNgnData);
            // GUARANTEED ROLLBACK
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: normAsset,
                amount: cryptoToSell
            });
            throw new Error(`Kasa saka Naira a asusunka. An dawo maka da ${cryptoToSell} ${normAsset.toUpperCase()} 100%.`);
        }

        // 🛡️ 7. Transaction Audit Logging & Notifications
        const formattedCrypto = `${cryptoToSell} ${normAsset.toUpperCase()}`;
        const refId = `sell_${Date.now()}_${user.id.slice(0, 6)}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_sell',
                amount: ngnToReceive,
                status: 'success',
                reference: refId,
                description: `Sayar da ${formattedCrypto} akan ₦${ngnToReceive.toLocaleString()}`
            }),
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
                    rate: effectiveSellRate
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `An yi nasarar sayar da ${formattedCrypto} akan ₦${ngnToReceive.toLocaleString()}!`,
            debitedCrypto: cryptoToSell,
            creditedNgn: ngnToReceive,
            asset: normAsset,
            rate: effectiveSellRate
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('[Crypto Sell Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Sayar da crypto ya gaza' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

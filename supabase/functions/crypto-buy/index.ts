import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';
import {
    validateUserSecurity,
    checkCryptoMaintenance,
    validateAsset,
    validateAmount,
    getAuthoritativeCryptoRates,
    TRANSACTION_LIMITS
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
        const profile = await validateUserSecurity(supabaseAdmin, user.id);
        await checkCryptoMaintenance(supabaseAdmin);

        const body = await req.json();
        const { asset, amountNgn } = body;

        // 🛡️ 2. Asset & Amount Validation
        const normAsset = validateAsset(asset);
        const costNgn = validateAmount(amountNgn, TRANSACTION_LIMITS.MIN_NGN_BUY, TRANSACTION_LIMITS.MAX_NGN_BUY);

        // 🛡️ 3. Authoritative Rate Enforcement (Zero Client Trust)
        const authoritativeRates = await getAuthoritativeCryptoRates(supabaseAdmin);
        const effectiveRate = authoritativeRates.getBuyRateNgn(normAsset);

        const precision = normAsset === 'btc' ? 8 : normAsset === 'eth' ? 6 : normAsset === 'sol' || normAsset === 'bnb' ? 5 : 4;
        const cryptoReceived = Number((costNgn / effectiveRate).toFixed(precision));

        if (cryptoReceived <= 0) {
            throw new Error('Adadin kudin ya yi kadan don siyan wannan kudin a farashin yanzu.');
        }

        // 🛡️ 4. Server-Side Balance Verification
        const currentNgn = Number(profile.balance || 0);
        if (currentNgn < costNgn) {
            throw new Error(`Kudin da ke asusunka bai isa ba. Ana buƙatar ₦${costNgn.toLocaleString()}, amma kana da ₦${currentNgn.toLocaleString()}`);
        }

        // 🛡️ 5. Atomic Naira Deduction
        const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('deduct_balance', {
            user_id: user.id,
            amount: costNgn
        });

        const deductSuccess = !deductErr && (
            typeof deductData === 'number' ||
            !isNaN(Number(deductData)) ||
            (typeof deductData === 'object' && deductData !== null && deductData.success === true) ||
            deductData === true
        );
        if (deductErr || !deductSuccess) {
            console.error('[Crypto Buy] Naira deduction failed:', deductErr || deductData);
            throw new Error('Kasa cire kudi daga asusun Naira. An dakatar da cinikin.');
        }

        // 🛡️ 6. Atomic Crypto Credit with Fail-Safe Rollback
        const { data: creditData, error: creditErr } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: user.id,
            asset: normAsset,
            amount: cryptoReceived
        });

        if (creditErr || !creditData?.success) {
            console.error('[Crypto Buy] Crypto credit failed, rolling back Naira:', creditErr || creditData);
            // GUARANTEED ROLLBACK
            await supabaseAdmin.rpc('credit_balance', {
                user_id: user.id,
                amount: costNgn
            });
            throw new Error(`An samu matsala wajen saka crypto. An dawo maka da ₦${costNgn.toLocaleString()} a asusunka 100%.`);
        }

        // 🛡️ 7. Transaction Audit Logging & Notifications
        const formattedCrypto = `${cryptoReceived} ${normAsset.toUpperCase()}`;
        const refId = `buy_${Date.now()}_${user.id.slice(0, 6)}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_buy',
                amount: costNgn,
                status: 'success',
                reference: refId,
                description: `Siyan ${formattedCrypto} akan ₦${costNgn.toLocaleString()}`
            }),
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
                    rate: effectiveRate
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `An yi nasarar siyan ${formattedCrypto}!`,
            credited: cryptoReceived,
            debitedNgn: costNgn,
            asset: normAsset,
            rate: effectiveRate
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('[Crypto Buy Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Cinikin crypto ya gaza' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

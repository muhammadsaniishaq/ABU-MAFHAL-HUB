import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';
import {
    validateUserSecurity,
    checkCryptoMaintenance,
    validateAsset,
    validateAmount,
    getAuthoritativeCryptoRates,
    computeSafeSwapOutput
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
        const { fromAsset, toAsset, amountIn } = body;

        // 🛡️ 2. Asset & Amount Validation
        const normFrom = validateAsset(fromAsset);
        const normTo = validateAsset(toAsset);
        const inAmt = validateAmount(amountIn, 0.00000001, 1_000_000);

        if (normFrom === normTo) {
            throw new Error('Ba za ka iya canza kudi zuwa kansa ba (Cannot swap an asset for itself).');
        }

        // 🛡️ 3. Authoritative Server-Side Output Calculation (Completely Ignores Client-Supplied Out Amount)
        const authoritativeRates = await getAuthoritativeCryptoRates(supabaseAdmin);
        const { safeAmountOut, feePercent, grossUsdValue, feeUsd, netUsdValue } = computeSafeSwapOutput(
            normFrom,
            normTo,
            inAmt,
            authoritativeRates
        );

        // 🛡️ 4. Server-Side Balance Verification
        const { data: balRecord, error: balErr } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', normFrom)
            .maybeSingle();

        const curBal = Number(balRecord?.balance || 0);
        if (balErr || curBal < inAmt) {
            throw new Error(`Kudin da ke asusunka bai isa ba. Ana buƙatar: ${inAmt} ${normFrom.toUpperCase()}, amma kana da: ${curBal} ${normFrom.toUpperCase()}`);
        }

        // 🛡️ 5. Atomically Deduct fromAsset
        const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: normFrom,
            amount: inAmt
        });

        if (deductError || !deductionResult?.success) {
            console.error('[Crypto Swap] Deduction error:', deductError || deductionResult);
            throw new Error(deductionResult?.error || `Kudin ${normFrom.toUpperCase()} bai isa a asusunka ba.`);
        }

        // 🛡️ 6. Atomically Credit toAsset with Fail-Safe Rollback
        const { data: creditResult, error: creditError } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: user.id,
            asset: normTo,
            amount: safeAmountOut
        });

        if (creditError || !creditResult?.success) {
            console.error('[Crypto Swap] Credit error, rolling back:', creditError || creditResult);
            // GUARANTEED ROLLBACK
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: normFrom,
                amount: inAmt
            });
            throw new Error(`Kasa saka ${normTo.toUpperCase()}. An dawo maka da ${inAmt} ${normFrom.toUpperCase()} a asusunka 100%.`);
        }

        // 🛡️ 7. Transaction Audit Logging & Notifications
        const refId = `swap_${Date.now()}_${user.id.slice(0, 6)}`;
        const swapDesc = `Swapped ${inAmt} ${normFrom.toUpperCase()} for ${safeAmountOut} ${normTo.toUpperCase()}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_swap',
                amount: safeAmountOut,
                status: 'success',
                reference: refId,
                description: swapDesc
            }),
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_swap',
                title: 'Crypto Swap Completed 🔄',
                body: `You successfully swapped ${inAmt} ${normFrom.toUpperCase()} into ${safeAmountOut} ${normTo.toUpperCase()}!`,
                amount: safeAmountOut,
                asset: normTo,
                reference: refId,
                fee: `${feePercent}% Platform fee ($${feeUsd})`,
                extraData: {
                    fromAsset: normFrom,
                    toAsset: normTo,
                    amountIn: inAmt,
                    amountOut: safeAmountOut,
                    grossUsdValue,
                    netUsdValue
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `An yi nasarar canza ${inAmt} ${normFrom.toUpperCase()} zuwa ${safeAmountOut} ${normTo.toUpperCase()}!`,
            data: {
                fromAsset: normFrom,
                toAsset: normTo,
                amountIn: inAmt,
                amountOut: safeAmountOut,
                feePercent
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('[Crypto Swap Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Canjin crypto ya gaza' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

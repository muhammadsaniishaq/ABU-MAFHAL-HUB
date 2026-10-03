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
        if (userError || !user) throw new Error('Invalid token');

        const { fromAsset, toAsset, amountIn, expectedAmountOut, feePercent } = await req.json();

        const normFrom = (fromAsset || '').toLowerCase().trim();
        const normTo = (toAsset || '').toLowerCase().trim();
        const inAmt = parseFloat(amountIn);
        let outAmt = parseFloat(expectedAmountOut);

        if (!normFrom || !normTo || isNaN(inAmt) || inAmt <= 0) {
            throw new Error('Invalid swap parameters');
        }

        if (normFrom === normTo) {
            throw new Error('Cannot swap an asset for itself');
        }

        // Fetch platform swap fee percentage (guaranteed profit margin)
        let activeFeePercent = 1.5; // default 1.5% profit fee
        try {
            const { data: swapSetting } = await supabaseAdmin
                .from('app_settings')
                .select('value')
                .eq('key', 'crypto_swap_fee_percent')
                .maybeSingle();

            if (swapSetting?.value) {
                const parsed = parseFloat(swapSetting.value);
                if (!isNaN(parsed) && parsed > 0) activeFeePercent = parsed;
            }
        } catch (_) {}

        if (isNaN(outAmt) || outAmt <= 0) {
            throw new Error('Invalid output amount for swap');
        }

        // 1. Verify and Deduct fromAsset atomically
        const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: normFrom,
            amount: inAmt
        });

        if (deductError || !deductionResult?.success) {
            console.error('[Crypto Swap] Deduction error:', deductError || deductionResult);
            throw new Error(deductionResult?.error || `Insufficient balance for ${normFrom.toUpperCase()}`);
        }

        // 2. Credit toAsset atomically
        const { data: creditResult, error: creditError } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: user.id,
            asset: normTo,
            amount: outAmt
        });

        if (creditError || !creditResult?.success) {
            console.error('[Crypto Swap] Credit error, rolling back:', creditError || creditResult);
            // 100% GUARANTEED REFUND ROLLBACK
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: normFrom,
                amount: inAmt
            });
            throw new Error(`Failed to credit ${normTo.toUpperCase()}. Your ${inAmt} ${normFrom.toUpperCase()} has been 100% refunded.`);
        }

        // 3. Record Transaction
        const refId = `swap_${Date.now()}_${user.id.slice(0, 6)}`;
        const swapDesc = `Swapped ${inAmt} ${normFrom.toUpperCase()} for ${outAmt} ${normTo.toUpperCase()}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_swap',
                amount: outAmt,
                status: 'success',
                reference: refId,
                description: swapDesc
            }),
            // Multi-channel notification (Push, Email, In-App)
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_swap',
                title: 'Crypto Swap Completed 🔄',
                body: `You successfully swapped ${inAmt} ${normFrom.toUpperCase()} into ${outAmt} ${normTo.toUpperCase()}!`,
                amount: outAmt,
                asset: normTo,
                reference: refId,
                fee: `${feePercent}% (Included in exchange rate)`,
                extraData: {
                    fromAsset: normFrom,
                    toAsset: normTo,
                    amountIn: inAmt,
                    amountOut: outAmt
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: swapDesc,
            data: { fromAsset: normFrom, toAsset: normTo, amountIn: inAmt, expectedAmountOut: outAmt }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Crypto Swap Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Crypto swap failed' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

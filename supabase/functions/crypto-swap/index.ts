import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

        const { fromAsset, toAsset, amountIn, expectedAmountOut } = await req.json();

        if (!fromAsset || !toAsset || !amountIn || amountIn <= 0 || !expectedAmountOut || expectedAmountOut <= 0) {
            throw new Error('Invalid swap parameters');
        }

        // 1. Deduct fromAsset securely via RPC
        const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: fromAsset.toLowerCase(),
            amount: amountIn
        });

        if (deductError || !deductionResult?.success) {
            console.error("Deduction error:", deductError || deductionResult);
            throw new Error(deductionResult?.error || `Insufficient balance for ${fromAsset}`);
        }

        // 2. Credit toAsset securely via RPC
        const { data: creditResult, error: creditError } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: user.id,
            asset: toAsset.toLowerCase(),
            amount: expectedAmountOut
        });

        if (creditError || !creditResult?.success) {
            console.error("Credit error:", creditError || creditResult);
            // ROLLBACK DEDUCTION IF CREDIT FAILS
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: fromAsset.toLowerCase(),
                amount: amountIn
            });
            throw new Error(`Failed to credit ${toAsset}. Swap reverted.`);
        }

        // 3. Record Transaction
        await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                type: 'crypto_swap',
                amount: expectedAmountOut, // Amount received
                status: 'success',
                description: `Swapped ${amountIn} ${fromAsset.toUpperCase()} for ${expectedAmountOut} ${toAsset.toUpperCase()}`
            });

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Swap completed successfully',
            data: { fromAsset, toAsset, amountIn, expectedAmountOut }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Crypto Swap Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 200, // Return 200 so client reads body easily
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

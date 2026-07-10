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

        const { asset, amountCrypto, expectedNgn } = await req.json();

        if (!asset || !amountCrypto || !expectedNgn || amountCrypto <= 0) {
            throw new Error('Invalid sell parameters');
        }

        // 1. Check Crypto Balance
        const { data: cryptoBal, error: cbError } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', asset)
            .single();

        if (cbError || !cryptoBal || cryptoBal.balance < amountCrypto) {
            throw new Error(`Insufficient ${asset} balance in your Crypto Wallet`);
        }

        // 2. Deduct Crypto Balance
        const { error: deductError } = await supabaseAdmin.rpc('update_crypto_balance', {
            p_user_id: user.id,
            p_asset: asset,
            p_amount: -amountCrypto
        });

        if (deductError) {
            throw new Error('Failed to deduct crypto balance');
        }

        // 3. Add to NGN Balance
        // Get current NGN balance
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (!profileError && profile) {
            await supabaseAdmin
                .from('profiles')
                .update({ balance: profile.balance + expectedNgn })
                .eq('id', user.id);
        }

        // 4. Record Transaction as Success
        const { error: txnError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                type: 'crypto_sell',
                amount: expectedNgn, // Payout in NGN
                status: 'success', 
                description: `Sold ${amountCrypto} ${asset} instantly for ₦${expectedNgn}`
            });

        return new Response(JSON.stringify({ success: true, message: 'Sell successful. Naira credited instantly.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Crypto Sell Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

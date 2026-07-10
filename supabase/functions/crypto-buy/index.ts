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

        // We removed 'network' and 'address' since this is an internal wallet buy
        const { asset, amountNgn, amountCrypto } = await req.json();

        if (!asset || !amountNgn || !amountCrypto || amountNgn <= 0) {
            throw new Error('Invalid buy parameters');
        }

        // 1. Check NGN Balance
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            throw new Error('Could not fetch user balance');
        }

        if (profile.balance < amountNgn) {
            throw new Error('Insufficient NGN balance to buy this crypto');
        }

        // 2. Deduct NGN Balance
        const newBalance = profile.balance - amountNgn;
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', user.id);

        if (updateError) {
            throw new Error('Failed to deduct Naira balance');
        }

        // 3. Add Crypto Balance
        const { error: addCryptoError } = await supabaseAdmin.rpc('update_crypto_balance', {
            p_user_id: user.id,
            p_asset: asset,
            p_amount: amountCrypto
        });

        if (addCryptoError) {
            // Revert NGN if crypto addition fails
            await supabaseAdmin.from('profiles').update({ balance: profile.balance }).eq('id', user.id);
            throw new Error('Failed to add crypto to wallet');
        }

        // 4. Record Transaction
        const { error: txnError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                type: 'crypto_buy',
                amount: amountNgn, // Cost in NGN
                status: 'success', // Instant internal transfer
                description: `Bought ${amountCrypto} ${asset} instantly for ₦${amountNgn}`
            });

        return new Response(JSON.stringify({ success: true, message: 'Buy successful. Crypto credited to your wallet.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Crypto Buy Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

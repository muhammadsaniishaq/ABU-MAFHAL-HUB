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

        const { recipientId, asset, amount } = await req.json();

        const cleanAsset = (asset || 'usdt').toLowerCase().trim();
        const amt = parseFloat(amount);
        const targetUserId = String(recipientId || '').trim();

        if (!targetUserId || !cleanAsset || isNaN(amt) || amt <= 0) {
            throw new Error('Invalid transfer parameters');
        }

        if (targetUserId === user.id) {
            throw new Error('Cannot transfer crypto to yourself');
        }

        // 1. Verify recipient exists
        const { data: recipientProfile, error: recErr } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', targetUserId)
            .maybeSingle();

        if (recErr || !recipientProfile) {
            throw new Error('Recipient user account not found');
        }

        // 2. Verify sender crypto balance
        const { data: senderBalRec } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', cleanAsset)
            .maybeSingle();

        const curBal = Number(senderBalRec?.balance || 0);
        if (curBal < amt) {
            throw new Error(`Insufficient ${cleanAsset.toUpperCase()} balance. Available: ${curBal}, Required: ${amt}`);
        }

        // 3. Atomically Deduct sender balance
        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: cleanAsset,
            amount: amt
        });

        if (deductError || !deductResult?.success) {
            throw new Error(deductResult?.error || 'Failed to deduct crypto balance.');
        }

        // 4. Atomically Credit recipient balance
        const { data: creditResult, error: creditError } = await supabaseAdmin.rpc('credit_crypto_balance', {
            user_id: targetUserId,
            asset: cleanAsset,
            amount: amt
        });

        if (creditError || !creditResult?.success) {
            // Guaranteed rollback
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: cleanAsset,
                amount: amt
            });
            throw new Error('Failed to credit recipient. Your funds have been refunded.');
        }

        // 5. Record transactions
        const refId = `c_tx_${Date.now()}_${user.id.slice(0, 4)}`;
        const formattedAmount = `${amt} ${cleanAsset.toUpperCase()}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_transfer_out',
                amount: amt,
                status: 'success',
                reference: refId,
                description: `Sent: ${formattedAmount} to ${recipientProfile.full_name || recipientProfile.phone}`
            }),
            supabaseAdmin.from('transactions').insert({
                user_id: targetUserId,
                type: 'crypto_transfer_in',
                amount: amt,
                status: 'success',
                reference: refId,
                description: `Received: ${formattedAmount} from Abu Mafhal User`
            }),
            notifyCryptoUser({
                supabaseAdmin,
                userId: targetUserId,
                type: 'crypto_transfer',
                title: 'Crypto Received! 🎉',
                body: `You received +${formattedAmount} via Zero-Gas Abu Mafhal Transfer!`,
                amount: amt,
                asset: cleanAsset,
                reference: refId
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully transferred ${formattedAmount}!`,
            reference: refId
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('[Crypto Transfer Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Internal transfer failed' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

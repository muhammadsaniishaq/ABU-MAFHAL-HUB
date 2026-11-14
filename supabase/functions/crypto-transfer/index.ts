import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';
import {
    validateUserSecurity,
    checkCryptoMaintenance,
    validateAsset,
    validateAmount,
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
        const senderProfile = await validateUserSecurity(supabaseAdmin, user.id);
        await checkCryptoMaintenance(supabaseAdmin);

        const body = await req.json();
        const { recipientId, asset, amount } = body;

        // 🛡️ 2. Asset & Amount Validation
        const cleanAsset = validateAsset(asset);
        const amt = validateAmount(amount, TRANSACTION_LIMITS.MIN_TRANSFER_AMOUNT, 50_000);
        const targetUserId = String(recipientId || '').trim();

        if (!targetUserId) {
            throw new Error('Dole ne ka zabi wanda za a tura masa kudin.');
        }

        if (targetUserId === user.id) {
            throw new Error('Ba za ka iya tura kudi zuwa kanka ba.');
        }

        // 🛡️ 3. Recipient Security & Validity Check
        const recipientProfile = await validateUserSecurity(supabaseAdmin, targetUserId);

        // 🛡️ 4. Sender Balance Verification
        const { data: senderBalRec, error: senderBalErr } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', cleanAsset)
            .maybeSingle();

        const curBal = Number(senderBalRec?.balance || 0);
        if (senderBalErr || curBal < amt) {
            throw new Error(`Kudin ${cleanAsset.toUpperCase()} da ke asusunka bai isa ba. Kana da: ${curBal}, amma ana buƙatar: ${amt}`);
        }

        // 🛡️ 5. Atomically Deduct Sender Balance
        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: cleanAsset,
            amount: amt
        });

        if (deductError || !deductResult?.success) {
            throw new Error(deductResult?.error || 'Kasa cire kudi daga asusunka. An dakatar da aikin.');
        }

        // 🛡️ 6. Atomically Credit Recipient Balance with Fail-Safe Rollback
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
            throw new Error('Kasa saka kudi ga wanda aka tura wa. An mayar maka da kudinka 100%.');
        }

        // 🛡️ 7. Transaction Audit Logging & Notifications
        const refId = `c_tx_${Date.now()}_${user.id.slice(0, 4)}`;
        const formattedAmount = `${amt} ${cleanAsset.toUpperCase()}`;
        const recipientName = recipientProfile.full_name || recipientProfile.phone || 'Abu Mafhal User';
        const senderName = senderProfile.full_name || senderProfile.phone || 'Abu Mafhal User';

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_transfer_out',
                amount: amt,
                status: 'success',
                reference: refId,
                description: `Tura: ${formattedAmount} ga ${recipientName}`
            }),
            supabaseAdmin.from('transactions').insert({
                user_id: targetUserId,
                type: 'crypto_transfer_in',
                amount: amt,
                status: 'success',
                reference: refId,
                description: `Karɓa: ${formattedAmount} daga ${senderName}`
            }),
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_transfer',
                title: 'Crypto Sent Successfully! 📤',
                body: `You sent ${formattedAmount} to ${recipientName} with Zero Gas Fees.`,
                amount: amt,
                asset: cleanAsset,
                reference: refId,
                recipientOrAddress: recipientName
            }),
            notifyCryptoUser({
                supabaseAdmin,
                userId: targetUserId,
                type: 'crypto_transfer',
                title: 'Crypto Received! 🎉',
                body: `You received +${formattedAmount} from ${senderName} via Zero-Gas Abu Mafhal Transfer!`,
                amount: amt,
                asset: cleanAsset,
                reference: refId,
                recipientOrAddress: senderName
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `An yi nasarar tura ${formattedAmount} ga ${recipientName}!`,
            reference: refId
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('[Crypto Transfer Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Tura kudin crypto ya gaza' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyCryptoUser } from '../_shared/crypto-notifier.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Network fee lookup defaults
const DEFAULT_FEES: Record<string, number> = {
    'TRC20': 1.5,
    'BEP20': 1.0,
    'ERC20': 12.0,
    'POLYGON': 0.8,
    'SOL': 0.8,
    'BTC': 0.0004,
    'ETH': 0.002,
    'TRX': 1.5,
    'BNB': 0.005,
    'TON': 0.05
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

        const body = await req.json();
        const { network, address, amountUsdt, asset = 'usdt', clientFee } = body;

        const normAsset = (asset || 'usdt').toLowerCase().trim();
        const normNetwork = (network || 'TRC20').toUpperCase().trim();
        const sendAmount = parseFloat(amountUsdt);

        if (!normNetwork || !address || isNaN(sendAmount) || sendAmount <= 0) {
            throw new Error('Invalid withdrawal parameters: amount and destination address are required');
        }

        // 1. Determine Base API Provider Network Fee + Platform Admin Profit Markup
        // "kayi dinga dakko fee na api sannan a kara da namu fee din kar ya zma yana fita free"
        let baseApiFee = DEFAULT_FEES[normNetwork] || 1.0;
        let adminProfitMarkup = 0.5; // default platform profit margin

        // Check if admin configured custom fee or profit markup in app_settings
        try {
            const { data: feeSettings } = await supabaseAdmin
                .from('app_settings')
                .select('key, value')
                .in('key', [
                    `crypto_fee_${normNetwork.toLowerCase()}_${normAsset}`,
                    'crypto_fee_trc20_usdt',
                    'crypto_fee_bep20_usdt',
                    'crypto_fee_erc20_usdt',
                    'crypto_fee_btc',
                    'crypto_fee_eth',
                    'crypto_withdraw_profit_margin'
                ]);

            if (feeSettings && feeSettings.length > 0) {
                const markupSetting = feeSettings.find(s => s.key === 'crypto_withdraw_profit_margin');
                if (markupSetting?.value) {
                    const parsedMarkup = parseFloat(markupSetting.value);
                    if (!isNaN(parsedMarkup) && parsedMarkup >= 0) adminProfitMarkup = parsedMarkup;
                }

                // Check network-specific total fee
                const netKey = `crypto_fee_${normNetwork.toLowerCase()}_${normAsset}`;
                const matched = feeSettings.find(s => s.key === netKey);
                if (matched?.value) {
                    const parsed = parseFloat(matched.value);
                    if (!isNaN(parsed) && parsed > 0) {
                        baseApiFee = parsed;
                    }
                } else if (normAsset === 'usdt') {
                    const usdtKey = `crypto_fee_${normNetwork.toLowerCase()}_usdt`;
                    const usdtSetting = feeSettings.find(s => s.key === usdtKey || s.key === 'crypto_fee_trc20_usdt');
                    if (usdtSetting?.value) {
                        const parsed = parseFloat(usdtSetting.value);
                        if (!isNaN(parsed) && parsed > 0) baseApiFee = parsed;
                    }
                }
            }
        } catch (_) {}

        // Enforce strictly profitable fee: api_cost + platform_profit (NEVER 0, NEVER free)
        const withdrawalFee = Number((baseApiFee + adminProfitMarkup).toFixed(6));
        const totalDeduct = Number((sendAmount + withdrawalFee).toFixed(6));

        // 2. Pre-flight Balance Verification (NEVER touch funds if insufficient)
        const { data: balRecord, error: balErr } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', normAsset)
            .maybeSingle();

        const currentBal = Number(balRecord?.balance || 0);
        if (balErr || currentBal < totalDeduct) {
            throw new Error(`Insufficient ${normAsset.toUpperCase()} balance. Required: ${totalDeduct.toFixed(4)} (Amount: ${sendAmount} + Fee: ${withdrawalFee}), Available: ${currentBal.toFixed(4)}`);
        }

        // 3. Atomically Deduct Balance with safety guard
        const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: normAsset,
            amount: totalDeduct
        });

        if (deductError || !deductionResult?.success) {
            console.error('[Crypto Withdraw] Atomic deduction failure:', deductError || deductionResult);
            throw new Error(deductionResult?.error || 'Failed to safely reserve crypto balance for payout');
        }

        // 4. Provider Payout Execution (NowPayments)
        let NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY') || Deno.env.get('NOWPAYMENTS_KEY');
        let NOWPAYMENTS_EMAIL = Deno.env.get('NOWPAYMENTS_EMAIL');
        let NOWPAYMENTS_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            const { data: secrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_KEY', 'NOWPAYMENTS_EMAIL', 'NOWPAYMENTS_PASSWORD']);

            if (secrets) {
                const apiSecret = secrets.find(s => s.key === 'NOWPAYMENTS_API_KEY' || s.key === 'NOWPAYMENTS_KEY');
                const emailSecret = secrets.find(s => s.key === 'NOWPAYMENTS_EMAIL');
                const passSecret = secrets.find(s => s.key === 'NOWPAYMENTS_PASSWORD');
                if (apiSecret) NOWPAYMENTS_API_KEY = apiSecret.value?.trim();
                if (emailSecret) NOWPAYMENTS_EMAIL = emailSecret.value?.trim();
                if (passSecret) NOWPAYMENTS_PASSWORD = passSecret.value?.trim();
            }
        }

        let payoutId: string | null = null;
        let payoutSuccessful = false;

        // Rollback helper to guarantee user's funds are 100% returned on any failure
        const rollbackFunds = async (reason: string) => {
            console.warn(`[Crypto Withdraw] Rolling back ${totalDeduct} ${normAsset.toUpperCase()} to user ${user.id}. Reason: ${reason}`);
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: normAsset,
                amount: totalDeduct
            });
        };

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            await rollbackFunds('Gateway credentials incomplete in system settings');
            throw new Error('Payout gateway is not fully configured (Missing API credentials in Admin Vault). Your funds have been completely restored.');
        }

        try {
            // A. Authenticate with provider
            const authRes = await fetch('https://api.nowpayments.io/v1/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: NOWPAYMENTS_EMAIL,
                    password: NOWPAYMENTS_PASSWORD
                })
            });
            const authData = await authRes.json();

            if (!authRes.ok || !authData.token) {
                await rollbackFunds(authData.message || 'Provider authentication failed');
                throw new Error(authData.message || 'Failed to authenticate with payout gateway. Your balance was not deducted.');
            }

            // B. Dispatch Payout
            const providerCurrency = normAsset === 'usdt' ? `usdt${normNetwork.toLowerCase()}` : normAsset;
            const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
                method: 'POST',
                headers: {
                    'x-api-key': NOWPAYMENTS_API_KEY,
                    'Authorization': `Bearer ${authData.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    withdrawals: [{
                        address: address.trim(),
                        currency: providerCurrency,
                        amount: sendAmount,
                        ipn_callback_url: `${supabaseUrl}/functions/v1/crypto-webhook`
                    }]
                })
            });

            const payoutData = await payoutRes.json();

            if (payoutRes.ok && payoutData?.withdrawals && payoutData.withdrawals.length > 0) {
                payoutSuccessful = true;
                payoutId = String(payoutData.withdrawals[0].id || payoutData.id || `payout_${Date.now()}`);
            } else {
                console.error('[NowPayments Payout Failed]:', payoutData);
                await rollbackFunds(payoutData?.message || 'Provider rejected withdrawal');
                throw new Error(payoutData?.message || 'Payout request rejected by provider. Your funds have been safely restored.');
            }

        } catch (apiErr: any) {
            // Guarantee rollback if not already rolled back
            if (!payoutSuccessful) {
                await rollbackFunds(apiErr.message || 'Network exception during payout');
            }
            throw apiErr;
        }

        // 5. Successful Withdrawal Accounting
        const formattedSend = `${sendAmount} ${normAsset.toUpperCase()}`;
        const formattedFee = `${withdrawalFee} ${normAsset.toUpperCase()}`;

        await Promise.allSettled([
            // User transaction record
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_withdrawal',
                amount: totalDeduct,
                status: 'success',
                reference: payoutId,
                description: `Crypto Withdrawal: Sent ${formattedSend} to ${address} (Fee: ${formattedFee})`
            }),
            // Multi-channel Notification (Push, Email, In-App)
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_withdrawal',
                title: 'Crypto Withdrawal Sent 🚀',
                body: `Your withdrawal of ${formattedSend} to ${address.slice(0, 8)}...${address.slice(-6)} has been dispatched! Network fee: ${formattedFee}.`,
                amount: sendAmount,
                asset: normAsset,
                reference: payoutId || undefined,
                fee: formattedFee,
                recipientOrAddress: address,
                extraData: {
                    network: normNetwork,
                    totalDeducted: totalDeduct
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Withdrawal of ${formattedSend} dispatched successfully!`,
            payoutId,
            sentAmount: sendAmount,
            fee: withdrawalFee,
            totalDeducted: totalDeduct
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Crypto Withdraw Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Withdrawal processing failed' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

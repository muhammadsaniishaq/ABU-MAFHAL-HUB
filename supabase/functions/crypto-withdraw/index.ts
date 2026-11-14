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

const SUPPORTED_NETWORKS = [
    'TRC20', 'BEP20', 'ERC20', 'POLYGON', 'SOL', 'BTC', 'ETH', 'TRX', 'BNB', 'TON'
];

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
        const { network, address, amountUsdt, asset = 'usdt' } = body;

        // 🛡️ 2. Asset & Network & Address Validation
        const normAsset = validateAsset(asset);
        const normNetwork = (network || 'TRC20').toUpperCase().trim();
        const destAddress = String(address || '').trim();

        if (!SUPPORTED_NETWORKS.includes(normNetwork)) {
            throw new Error(`Hanyar tura kudi (Network) '${network}' ba daidai ba ce.`);
        }

        if (!destAddress || destAddress.length < 15) {
            throw new Error('Adireshin walat din da aka bayar bai cika ka\'ida ba.');
        }

        // Basic address checksum heuristics
        if (normNetwork === 'TRC20' || normNetwork === 'TRX') {
            if (!destAddress.startsWith('T') || destAddress.length !== 34) {
                throw new Error('Adireshin Tron (TRC20/TRX) dole ne ya fara da harafin T kuma ya zama haruffa 34.');
            }
        } else if (normNetwork === 'ERC20' || normNetwork === 'BEP20' || normNetwork === 'POLYGON' || normNetwork === 'ETH' || normNetwork === 'BNB') {
            if (!destAddress.startsWith('0x') || destAddress.length !== 42) {
                throw new Error('Adireshin EVM (ERC20/BEP20) dole ne ya fara da 0x kuma ya zama haruffa 42.');
            }
        }

        const sendAmount = validateAmount(amountUsdt, 0.00000001, 100_000);

        // 🛡️ 3. Authoritative Network Fee + Platform Admin Profit Markup
        let baseApiFee = DEFAULT_FEES[normNetwork] || 1.0;
        let adminProfitMarkup = 0.5;

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

                const netKey = `crypto_fee_${normNetwork.toLowerCase()}_${normAsset}`;
                const matched = feeSettings.find(s => s.key === netKey);
                if (matched?.value) {
                    const parsed = parseFloat(matched.value);
                    if (!isNaN(parsed) && parsed > 0) baseApiFee = parsed;
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

        const withdrawalFee = Number((baseApiFee + adminProfitMarkup).toFixed(6));
        const totalDeduct = Number((sendAmount + withdrawalFee).toFixed(6));

        // 🛡️ 4. Server-Side Balance Verification (Strict Pre-flight)
        const { data: balRecord, error: balErr } = await supabaseAdmin
            .from('crypto_balances')
            .select('balance')
            .eq('user_id', user.id)
            .eq('asset', normAsset)
            .maybeSingle();

        const currentBal = Number(balRecord?.balance || 0);
        if (balErr || currentBal < totalDeduct) {
            throw new Error(`Kudin da ke asusunka bai isa ba. Ana buƙatar: ${totalDeduct.toFixed(4)} ${normAsset.toUpperCase()} (Kudi: ${sendAmount} + Fee: ${withdrawalFee}), amma kana da: ${currentBal.toFixed(4)} ${normAsset.toUpperCase()}`);
        }

        // 🛡️ 5. Atomically Deduct Balance BEFORE Dispatch
        const { data: deductionResult, error: deductError } = await supabaseAdmin.rpc('deduct_crypto_balance', {
            user_id: user.id,
            asset: normAsset,
            amount: totalDeduct
        });

        if (deductError || !deductionResult?.success) {
            console.error('[Crypto Withdraw] Atomic deduction failure:', deductError || deductionResult);
            throw new Error(deductionResult?.error || 'Kasa cire kudi daga asusunka don cirewa. An dakatar da aikin.');
        }

        // 🛡️ 6. Provider Payout Execution (NowPayments)
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

        const rollbackFunds = async (reason: string) => {
            console.warn(`[Crypto Withdraw Rollback] User ${user.id} -> ${totalDeduct} ${normAsset.toUpperCase()}. Reason: ${reason}`);
            await supabaseAdmin.rpc('credit_crypto_balance', {
                user_id: user.id,
                asset: normAsset,
                amount: totalDeduct
            });
        };

        if (!NOWPAYMENTS_API_KEY || !NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
            await rollbackFunds('Gateway credentials incomplete in system settings');
            throw new Error('Sabis na cire kudi ba a kammala saita shi a Admin ba. An dawo maka da kudinka 100%.');
        }

        let payoutId: string | null = null;
        let payoutSuccessful = false;

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
                throw new Error('Hanyar tura kudi ta gaza yin tantancewa. An mayar da kudinka asusunka 100%.');
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
                        address: destAddress,
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
                throw new Error(payoutData?.message || 'Hanyar tura kudi ta ki amincewa da aikin. An mayar da kudinka asusunka 100%.');
            }

        } catch (apiErr: any) {
            if (!payoutSuccessful) {
                await rollbackFunds(apiErr.message || 'Network exception during payout');
            }
            throw apiErr;
        }

        // 🛡️ 7. Transaction Audit Logging & Notifications
        const formattedSend = `${sendAmount} ${normAsset.toUpperCase()}`;
        const formattedFee = `${withdrawalFee} ${normAsset.toUpperCase()}`;

        await Promise.allSettled([
            supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'crypto_withdrawal',
                amount: totalDeduct,
                status: 'success',
                reference: payoutId,
                description: `Cire Crypto: An tura ${formattedSend} zuwa ${destAddress} (Kudin aiki: ${formattedFee})`
            }),
            notifyCryptoUser({
                supabaseAdmin,
                userId: user.id,
                type: 'crypto_withdrawal',
                title: 'Crypto Withdrawal Sent 🚀',
                body: `Your withdrawal of ${formattedSend} to ${destAddress.slice(0, 8)}...${destAddress.slice(-6)} has been dispatched! Network fee: ${formattedFee}.`,
                amount: sendAmount,
                asset: normAsset,
                reference: payoutId || undefined,
                fee: formattedFee,
                recipientOrAddress: destAddress,
                extraData: {
                    network: normNetwork,
                    totalDeducted: totalDeduct
                }
            })
        ]);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `An yi nasarar tura ${formattedSend}!`,
            payoutId,
            sentAmount: sendAmount,
            fee: withdrawalFee,
            totalDeducted: totalDeduct
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('[Crypto Withdraw Error]:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Cire kudi ya gaza' 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

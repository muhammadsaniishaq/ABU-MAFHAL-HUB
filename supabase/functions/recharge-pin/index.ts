import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const authHeader = req.headers.get('Authorization');
        let user: any = null;
        if (authHeader) {
            const userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } }
            });
            const { data: { user: u } } = await userClient.auth.getUser();
            user = u;
        }

        const body = await req.json().catch(() => ({}));
        const { action = 'get-plans', planId, quantity = 1, businessName } = body;

        // Fetch BIGI API Token and PIN from system_secrets
        const { data: secrets } = await supabaseAdmin.from('system_secrets').select('key, value');
        const secretMap = new Map(secrets?.map((s: any) => [s.key, s.value]) || []);

        const bigiToken = secretMap.get('BIGI_API_TOKEN') || Deno.env.get('BIGI_API_TOKEN') || '';
        const bigiPin = secretMap.get('BIGI_API_PIN') || Deno.env.get('BIGI_API_PIN') || '0018';

        // 1. ACTION: GET RECHARGE PIN PLANS
        if (action === 'get-plans') {
            const res = await fetch('https://api.bigisub.ng/api/v2/vtu/recharge-pin/plans/', {
                headers: {
                    'Authorization': `Token ${bigiToken.trim()}`,
                    'Accept': 'application/json'
                }
            });
            const json = await res.json();

            if (!json.success || !Array.isArray(json.data)) {
                throw new Error(json.message || 'Failed to fetch recharge pin plans');
            }

            const formattedPlans = json.data.map((p: any) => ({
                id: p.id,
                network: p.network,
                networkName: (p.network_name || '').toLowerCase(),
                size: p.size,
                denomination: `₦${p.size}`,
                regularPrice: p.regular_price || p.corporate_price || parseFloat(p.size),
                corporatePrice: p.corporate_price || p.regular_price || parseFloat(p.size),
                price: p.regular_price || p.corporate_price || parseFloat(p.size),
                info: p.info || ''
            }));

            return new Response(JSON.stringify({
                success: true,
                message: 'Recharge pin plans retrieved successfully',
                data: formattedPlans
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. ACTION: PURCHASE RECHARGE PIN
        if (action === 'purchase') {
            if (!user && authHeader) {
                const token = authHeader.replace('Bearer ', '').trim();
                if (token) {
                    const { data: { user: u } } = await supabaseAdmin.auth.getUser(token);
                    user = u;
                }
            }

            if (!user) {
                throw new Error('Unauthorized: Please log in to purchase recharge pins');
            }

            if (!planId) {
                throw new Error('Please select a valid recharge pin plan');
            }

            const qty = Math.max(1, parseInt(quantity || 1, 10));

            // Fetch Plans to determine exact price and network details
            const plansRes = await fetch('https://api.bigisub.ng/api/v2/vtu/recharge-pin/plans/', {
                headers: {
                    'Authorization': `Token ${bigiToken.trim()}`,
                    'Accept': 'application/json'
                }
            });
            const plansJson = await plansRes.json();
            const targetPlan = plansJson?.data?.find((p: any) => p.id == planId) || {
                id: planId,
                network_name: 'MTN',
                size: '100',
                regular_price: 98.9
            };

            const unitPrice = parseFloat(targetPlan.regular_price || targetPlan.corporate_price || targetPlan.size || '98.9');
            const totalCost = unitPrice * qty;

            // Fetch User Profile and check balance
            const { data: profile, error: profErr } = await supabaseAdmin
                .from('profiles')
                .select('balance, full_name')
                .eq('id', user.id)
                .single();

            if (profErr || !profile) {
                throw new Error('User profile not found');
            }

            const currentBalance = parseFloat(profile.balance || 0);
            if (currentBalance < totalCost) {
                throw new Error(`Insufficient wallet balance. Total cost is ₦${totalCost.toFixed(2)}, but your balance is ₦${currentBalance.toFixed(2)}.`);
            }

            // Execute Live Purchase via Bigi API
            const purchaseRes = await fetch('https://api.bigisub.ng/api/v2/vtu/recharge-pin/purchase/', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${bigiToken.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan: planId,
                    quantity: qty,
                    business_name: businessName || 'ABU MAFHAL VTU',
                    pin: bigiPin.trim()
                })
            });

            const purchaseJson = await purchaseRes.json();

            if (!purchaseRes.ok || purchaseJson.success === false) {
                throw new Error(purchaseJson.message || purchaseJson.detail || purchaseJson.error || 'Recharge pin purchase failed at provider');
            }

            // Deduct User Balance
            const newBalance = currentBalance - totalCost;
            await supabaseAdmin
                .from('profiles')
                .update({ balance: newBalance })
                .eq('id', user.id);

            const pData = purchaseJson.data || purchaseJson;
            const pinsList = pData.pins || (pData.pin ? [{ pin: pData.pin, serial: pData.serial || '1' }] : []);

            const txId = 'RCP' + Date.now().toString(36).toUpperCase();
            await supabaseAdmin.from('recharge_pins').insert({
                user_id: user.id,
                transaction_id: txId,
                network: targetPlan.network_name?.toUpperCase() || 'MTN',
                denomination: `₦${targetPlan.size || '100'}`,
                amount: totalCost,
                quantity: qty,
                business_name: businessName || 'ABU MAFHAL VTU',
                pins: pinsList,
                load_code: pData.load_code || '*311*PIN#'
            }).catch(() => {});

            return new Response(JSON.stringify({
                success: true,
                message: 'Recharge pin purchase successful! 🎉',
                data: {
                    transactionId: txId,
                    network: targetPlan.network_name?.toUpperCase() || 'MTN',
                    denomination: `₦${targetPlan.size || '100'}`,
                    quantity: qty,
                    totalCost: totalCost,
                    businessName: businessName || 'ABU MAFHAL VTU',
                    pins: pinsList,
                    loadCode: pData.load_code || '*311*PIN#',
                    newBalance: newBalance
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error(`Invalid action: ${action}`);

    } catch (err: any) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message || 'An error occurred processing recharge pin request'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

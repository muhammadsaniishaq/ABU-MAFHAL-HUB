import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CLUBKONNECT_USER_ID, DEFAULT_CLUBKONNECT_API_KEY as _CLUBKONNECT_API_KEY } from "../_shared/clubkonnect.ts";

interface ClubKonnectPlan {
    PRODUCT?: ClubKonnectPlan | ClubKonnectPlan[];
    PRODUCT_ID?: string;
    ID?: string;
    id?: string;
    PLAN_ID?: string;
    plan_id?: string;
    PRODUCT_AMOUNT?: string;
    AMOUNT?: string;
    PRICE?: string;
    COST?: string;
    cost_price?: string;
    PRODUCT_NAME?: string;
    NAME?: string;
    TITLE?: string;
    PACKAGE_NAME?: string;
    [key: string]: unknown;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Verify Authorization (Admin Only)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization Header');

        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!anonKey) throw new Error('Missing Secret: SUPABASE_ANON_KEY');

        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) throw new Error('Unauthorized: User not found');

        const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin');
        if (adminError) throw new Error(`Database Error (is_admin): ${adminError.message}`);
        if (!isAdmin) throw new Error("Unauthorized: Access Denied (Admins Only)");

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Ensure api_vendor column exists in data_plans table
        try {
            await supabaseAdmin.rpc('exec_sql', {
                sql: `ALTER TABLE data_plans ADD COLUMN IF NOT EXISTS api_vendor TEXT DEFAULT 'clubkonnect';`
            });
        } catch (_) {
            // Ignore if RPC exec_sql is not available
        }

        // Parse Request Body for Target Vendor (e.g. 'clubkonnect', 'bigi', 'bilalsadasub', or 'all')
        const reqData = await req.json().catch(() => ({}));
        
        let targetVendors: string[] = [];
        if (reqData.vendor && reqData.vendor !== 'all') {
            targetVendors = [reqData.vendor.toLowerCase()];
        } else if (reqData.vendor === 'all') {
            targetVendors = ['clubkonnect', 'bigi', 'bilalsadasub'];
        } else {
            // Default to app_settings vtu_vendor or 'clubkonnect'
            const { data: vendorSetting } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'vtu_vendor').single();
            const activeVendor = vendorSetting?.value || 'clubkonnect';
            targetVendors = [activeVendor.toLowerCase()];
        }

        // Fetch Markup Configs
        const { data: configs } = await supabaseAdmin.from('data_configs').select('*');
        const configMap = new Map(configs?.map((c: any) => [c.network.toLowerCase(), c]) || []);

        let totalInserted = 0;
        const syncSummary: string[] = [];

        for (const vendor of targetVendors) {
            let networksData: any = {};

            if (vendor === 'bilalsadasub') {
                const bilalNetworks = ['MTN', 'AIRTEL', 'GLO', 'T2'];
                for (const net of bilalNetworks) {
                    try {
                        const res = await fetch(`https://bilalsadasub.com/api/v1/plans/data?network=${net}`);
                        const bRes = await res.json();
                        const plansList = bRes?.data || bRes;
                        if (Array.isArray(plansList)) {
                            networksData[net] = plansList.map((p: any) => ({
                                PRODUCT_ID: (p.plan_id || p.id).toString(),
                                PRODUCT_AMOUNT: (p.amount || 0).toString(),
                                PRODUCT_NAME: `${p.plan_name || p.name} (${p.plan_type || 'GIFTING'}) - ${p.plan_day || '30 days'}`,
                                validity: p.plan_day || '30 days',
                                volume: p.plan_name || ''
                            }));
                        }
                    } catch (err: any) {
                        console.error(`BilalSadaSub ${net} fetch failed:`, err);
                    }
                }
            } else if (vendor === 'bigi') {
                const { data: bigiTokenSetting } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'BIGI_API_TOKEN').single();
                const bigiToken = bigiTokenSetting?.value;
                if (!bigiToken) {
                    syncSummary.push(`Bigi skipped: Missing API Token`);
                    continue;
                }

                const bigiNetworks = [
                    { id: 1, name: 'MTN' },
                    { id: 2, name: 'GLO' },
                    { id: 3, name: 'AIRTEL' },
                    { id: 4, name: '9MOBILE' }
                ];

                for (const net of bigiNetworks) {
                    try {
                        const res = await fetch(`https://api.bigisub.ng/api/v2/vtu/data/plans/?network=${net.id}`, {
                            headers: { 'Authorization': `Bearer ${bigiToken}` }
                        });
                        const bigiRes = await res.json();
                        if (bigiRes.success && bigiRes.data) {
                            networksData[net.name] = bigiRes.data.map((p: any) => ({
                                PRODUCT_ID: p.id.toString(),
                                PRODUCT_AMOUNT: p.amount.toString(),
                                PRODUCT_NAME: `${p.size} ${p.plantype} - ${p.validity}`,
                                validity: p.validity,
                                volume: p.size
                            }));
                        }
                    } catch (err: any) {
                        console.error(`Bigi ${net.name} fetch failed:`, err);
                    }
                }
            } else {
                // ClubKonnect Logic
                try {
                    const { data: ckUserIdSetting } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'CLUBKONNECT_USER_ID').single();
                    const userId = ckUserIdSetting?.value || DEFAULT_CLUBKONNECT_USER_ID;
                    const url = `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${userId}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    networksData = data.MOBILE_NETWORK || data;
                } catch (err: any) {
                    console.error(`ClubKonnect fetch failed:`, err);
                }
            }

            let vendorInserted = 0;

            for (const netKey in networksData) {
                const plans = networksData[netKey];
                let networkName = netKey.toLowerCase();
                if (networkName.includes('mtn')) networkName = 'mtn';
                else if (networkName.includes('glo')) networkName = 'glo';
                else if (networkName.includes('airtel')) networkName = 'airtel';
                else if (networkName.includes('mobile') || networkName.includes('etisalat') || networkName.includes('t2')) networkName = '9mobile';

                if (!Array.isArray(plans)) continue;

                for (const item of plans) {
                    let properPlans: ClubKonnectPlan[] = [];
                    if (Array.isArray(item.PRODUCT)) {
                        properPlans = item.PRODUCT;
                    } else if (item.PRODUCT) {
                        properPlans = [item.PRODUCT];
                    } else {
                        properPlans = [item];
                    }

                    for (const plan of properPlans) {
                        const getVal = (regex: RegExp) => {
                            const keys = Object.keys(plan);
                            const match = keys.find(k => regex.test(k));
                            return match && plan[match] !== undefined ? String(plan[match]) : undefined;
                        }

                        let planId = plan.PRODUCT_ID || plan.ID || plan.id || plan.PLAN_ID || plan.plan_id;
                        if (!planId) planId = getVal(/id$/i);
                        if (!planId) continue;

                        const rawPrice = plan.PRODUCT_AMOUNT || plan.AMOUNT || plan.PRICE || plan.COST || plan.cost_price || getVal(/amount|price|cost/i);
                        const costPrice = parseFloat(rawPrice || '0');

                        const rawName = plan.PRODUCT_NAME || plan.NAME || plan.TITLE || plan.PACKAGE_NAME || getVal(/name|title|package/i);
                        let name = rawName || `${networkName.toUpperCase()} ${planId}`;

                        let validity = plan.validity || plan.VALIDITY;
                        if (!validity) {
                            const nameLower = name.toLowerCase();
                            if (nameLower.includes('daily') || nameLower.includes('24hr')) validity = '1 Day';
                            else if (nameLower.includes('weekly') || nameLower.includes('7 days')) validity = '7 Days';
                            else if (nameLower.includes('monthly') || nameLower.includes('30 days')) validity = '30 Days';
                            else validity = '30 Days';
                        }

                        const cleanName = name.replace(/\b(Daily|Weekly|Monthly|Day|Week|Month|Days|Weeks|Months|Hour|Hours|Hr|Hrs)\b/gi, '').replace(/\d+(hr|hrs)/gi, '').replace(/\-\s*/g, '').trim();

                        const config = configMap.get(networkName);
                        let finalSellingPrice = costPrice;
                        if (config) {
                            if (config.markup_type === 'percentage') {
                                finalSellingPrice = costPrice * (1 + (parseFloat(config.markup_value) / 100));
                            } else {
                                finalSellingPrice = costPrice + parseFloat(config.markup_value);
                            }
                        }
                        finalSellingPrice = Math.round(finalSellingPrice);

                        // Check if plan exists for this network, plan_id AND api_vendor
                        let query = supabaseAdmin.from('data_plans')
                            .select('id')
                            .eq('network', networkName)
                            .eq('plan_id', planId);

                        // Try matching api_vendor if supported
                        const { data: existingPlans } = await query;
                        const existingPlan = existingPlans?.[0];

                        let opError = null;
                        const recordData: any = {
                            network: networkName,
                            plan_id: planId,
                            name: cleanName,
                            cost_price: costPrice,
                            selling_price: finalSellingPrice,
                            is_active: true
                        };

                        // Add api_vendor field safely
                        try {
                            recordData.api_vendor = vendor;
                        } catch (_) {}

                        if (existingPlan) {
                            const { error } = await supabaseAdmin.from('data_plans')
                                .update(recordData)
                                .eq('id', existingPlan.id);
                            opError = error;
                        } else {
                            const { error } = await supabaseAdmin.from('data_plans')
                                .insert(recordData);
                            opError = error;
                        }

                        if (!opError) {
                            vendorInserted++;
                            totalInserted++;
                        }
                    }
                }
            }
            syncSummary.push(`${vendor.toUpperCase()}: ${vendorInserted} plans`);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Synced ${totalInserted} plans successfully! (${syncSummary.join(', ')})`,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
         const errorMessage = error instanceof Error ? error.message : "Unknown Error";
         return new Response(JSON.stringify({ success: false, error: errorMessage }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }
});

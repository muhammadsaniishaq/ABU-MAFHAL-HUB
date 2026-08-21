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

// Fail-safe Default Data Catalog for Networks
const DEFAULT_CATALOG: Record<string, any[]> = {
    'MTN': [
        { PRODUCT_ID: '500MB_SME', PRODUCT_AMOUNT: '150', PRODUCT_NAME: 'MTN 500MB SME (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '1GB_SME', PRODUCT_AMOUNT: '280', PRODUCT_NAME: 'MTN 1GB SME (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '2GB_SME', PRODUCT_AMOUNT: '560', PRODUCT_NAME: 'MTN 2GB SME (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '3GB_SME', PRODUCT_AMOUNT: '840', PRODUCT_NAME: 'MTN 3GB SME (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '5GB_SME', PRODUCT_AMOUNT: '1400', PRODUCT_NAME: 'MTN 5GB SME (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '10GB_SME', PRODUCT_AMOUNT: '2800', PRODUCT_NAME: 'MTN 10GB SME (30 Days)', validity: '30 Days' },
    ],
    'GLO': [
        { PRODUCT_ID: '1.35GB_DATA', PRODUCT_AMOUNT: '450', PRODUCT_NAME: 'GLO 1.35GB Data (14 Days)', validity: '14 Days' },
        { PRODUCT_ID: '2.9GB_DATA', PRODUCT_AMOUNT: '900', PRODUCT_NAME: 'GLO 2.9GB Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '5.8GB_DATA', PRODUCT_AMOUNT: '1800', PRODUCT_NAME: 'GLO 5.8GB Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '10GB_DATA', PRODUCT_AMOUNT: '2700', PRODUCT_NAME: 'GLO 10GB Data (30 Days)', validity: '30 Days' },
    ],
    'AIRTEL': [
        { PRODUCT_ID: '1GB_CG', PRODUCT_AMOUNT: '290', PRODUCT_NAME: 'Airtel 1GB Corporate Gifting (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '2GB_CG', PRODUCT_AMOUNT: '580', PRODUCT_NAME: 'Airtel 2GB Corporate Gifting (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '5GB_CG', PRODUCT_AMOUNT: '1450', PRODUCT_NAME: 'Airtel 5GB Corporate Gifting (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '10GB_CG', PRODUCT_AMOUNT: '2900', PRODUCT_NAME: 'Airtel 10GB Corporate Gifting (30 Days)', validity: '30 Days' },
    ],
    '9MOBILE': [
        { PRODUCT_ID: '1GB_DATA', PRODUCT_AMOUNT: '300', PRODUCT_NAME: '9Mobile 1GB Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '2GB_DATA', PRODUCT_AMOUNT: '600', PRODUCT_NAME: '9Mobile 2GB Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '5GB_DATA', PRODUCT_AMOUNT: '1500', PRODUCT_NAME: '9Mobile 5GB Data (30 Days)', validity: '30 Days' },
    ],
    'VITAL': [
        { PRODUCT_ID: '500MB_VITAL', PRODUCT_AMOUNT: '140', PRODUCT_NAME: 'VITAL 500MB Corporate Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '1GB_VITAL', PRODUCT_AMOUNT: '260', PRODUCT_NAME: 'VITAL 1GB Corporate Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '2GB_VITAL', PRODUCT_AMOUNT: '520', PRODUCT_NAME: 'VITAL 2GB Corporate Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '3GB_VITAL', PRODUCT_AMOUNT: '780', PRODUCT_NAME: 'VITAL 3GB Corporate Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '5GB_VITAL', PRODUCT_AMOUNT: '1300', PRODUCT_NAME: 'VITAL 5GB Corporate Data (30 Days)', validity: '30 Days' },
        { PRODUCT_ID: '10GB_VITAL', PRODUCT_AMOUNT: '2600', PRODUCT_NAME: 'VITAL 10GB Corporate Data (30 Days)', validity: '30 Days' },
    ]
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Ensure api_vendor column exists in data_plans table
        try {
            await supabaseAdmin.rpc('exec_sql', {
                sql: `ALTER TABLE data_plans ADD COLUMN IF NOT EXISTS api_vendor TEXT DEFAULT 'bilalsadasub';`
            });
        } catch (_) {}

        // Fix legacy vital/vitel api_vendor values in data_plans table
        try {
            await supabaseAdmin.from('data_plans')
                .update({ api_vendor: 'bilalsadasub' })
                .or('api_vendor.eq.vital,api_vendor.eq.vitel');
        } catch (_) {}

        // Parse Request Body for Target Vendor
        const reqData = await req.json().catch(() => ({}));
        
        let targetVendors: string[] = [];
        if (reqData.vendor && reqData.vendor !== 'all') {
            targetVendors = [reqData.vendor.toLowerCase()];
        } else {
            targetVendors = ['bilalsadasub', 'clubkonnect', 'bigi'];
        }

        // Fetch Markup Configs
        const { data: configs } = await supabaseAdmin.from('data_configs').select('*');
        const configMap = new Map(configs?.map((c: any) => [c.network.toLowerCase(), c]) || []);

        let globalTotalInserted = 0;
        const vendorBreakdown: Record<string, {
            name: string;
            total: number;
            networks: Record<string, number>;
            plans: any[];
        }> = {};

        for (const vendor of targetVendors) {
            let networksData: any = {};
            const vendorNameMap: Record<string, string> = {
                bilalsadasub: 'BilalSadaSub API',
                clubkonnect: 'ClubKonnect API',
                bigi: 'Bigi VTU API'
            };

            const currentVendorName = vendorNameMap[vendor] || vendor.toUpperCase();
            vendorBreakdown[vendor] = {
                name: currentVendorName,
                total: 0,
                networks: { MTN: 0, GLO: 0, AIRTEL: 0, '9MOBILE': 0, VITAL: 0 },
                plans: []
            };

            if (vendor === 'bilalsadasub') {
                const { data: tokenSetting } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'BILALSADASUB_TOKEN').maybeSingle();
                const bilalToken = tokenSetting?.value?.trim() || '';

                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (bilalToken) headers['Authorization'] = `Token ${bilalToken}`;

                const bilalNetworks = [
                    { code: 'MTN', canonical: 'mtn' },
                    { code: 'AIRTEL', canonical: 'airtel' },
                    { code: 'GLO', canonical: 'glo' },
                    { code: 'T2', canonical: '9mobile' },
                    { code: 'VITEL', canonical: 'vital' },
                ];

                for (const net of bilalNetworks) {
                    try {
                        let plansList: any[] = [];
                        const res = await fetch(`https://bilalsadasub.com/api/v1/plans/data?network=${net.code}`, { headers });
                        const bRes = await res.json().catch(() => null);
                        plansList = bRes?.data || (Array.isArray(bRes) ? bRes : []);

                        if (Array.isArray(plansList) && plansList.length > 0) {
                            networksData[net.canonical] = plansList.map((p: any) => ({
                                PRODUCT_ID: (p.plan_id || p.id).toString(),
                                PRODUCT_AMOUNT: (p.amount || p.price || 0).toString(),
                                PRODUCT_NAME: `${p.plan_name || p.name} (${p.plan_type || 'GIFTING'}) - ${p.plan_day || '30 days'} [BILAL]`,
                                validity: p.plan_day || '30 days',
                                volume: p.plan_name || ''
                            }));
                        }
                    } catch (err: any) {}
                }
            } else if (vendor === 'bigi') {
                const { data: bigiTokenSetting } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'BIGI_API_TOKEN').maybeSingle();
                const bigiToken = bigiTokenSetting?.value?.trim();

                if (bigiToken) {
                    const bigiNetworks = [
                        { id: 1, name: 'MTN', canonical: 'mtn' },
                        { id: 2, name: 'GLO', canonical: 'glo' },
                        { id: 3, name: 'AIRTEL', canonical: 'airtel' },
                        { id: 4, name: '9MOBILE', canonical: '9mobile' }
                    ];

                    for (const net of bigiNetworks) {
                        try {
                            const res = await fetch(`https://api.bigisub.ng/api/v2/vtu/data/plans/?network=${net.id}`, {
                                headers: { 'Authorization': `Bearer ${bigiToken}` }
                            });
                            const bigiRes = await res.json().catch(() => null);
                            if (bigiRes && bigiRes.success && Array.isArray(bigiRes.data)) {
                                networksData[net.canonical] = bigiRes.data.map((p: any) => ({
                                    PRODUCT_ID: p.id.toString(),
                                    PRODUCT_AMOUNT: p.amount.toString(),
                                    PRODUCT_NAME: `${p.size} ${p.plantype} - ${p.validity} [BIGI]`,
                                    validity: p.validity,
                                    volume: p.size
                                }));
                            }
                        } catch (err: any) {}
                    }
                }
            } else if (vendor === 'clubkonnect') {
                try {
                    const { data: secretsData } = await supabaseAdmin.from('system_secrets').select('key, value');
                    const { data: settingsData } = await supabaseAdmin.from('app_settings').select('key, value');
                    const sMap: Record<string, string> = {};
                    if (settingsData) settingsData.forEach((s: any) => { if (typeof s.value === 'string') sMap[s.key.toUpperCase()] = s.value; });
                    if (secretsData) secretsData.forEach((s: any) => { if (typeof s.value === 'string') sMap[s.key.toUpperCase()] = s.value; });

                    const userId = sMap['CLUBKONNECT_USER_ID'] || sMap['CLUBKONNECT_USER'] || DEFAULT_CLUBKONNECT_USER_ID || 'CK101269551';
                    const apiKey = sMap['CLUBKONNECT_API_KEY'] || sMap['CLUBKONNECT_KEY'] || '';
                    
                    const url1 = `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${userId}&APIKey=${apiKey}`;
                    const response1 = await fetch(url1);
                    const data1 = await response1.json().catch(() => null);
                    
                    if (data1 && (data1.MOBILE_NETWORK || data1.MTN || data1.AIRTEL)) {
                        networksData = data1.MOBILE_NETWORK || data1;
                    } else {
                        const url2 = `https://www.clubkonnect.com/APIDatabundlePlansV2.asp?UserID=${userId}&APIKey=${apiKey}`;
                        const response2 = await fetch(url2);
                        const data2 = await response2.json().catch(() => null);
                        if (data2) networksData = data2.MOBILE_NETWORK || data2;
                    }
                } catch (err: any) {}
            }

            // Fallback 1: Query existing data_plans in database for this vendor
            if (Object.keys(networksData).length === 0) {
                const { data: dbPlans } = await supabaseAdmin
                    .from('data_plans')
                    .select('*')
                    .eq('api_vendor', vendor);

                if (dbPlans && dbPlans.length > 0) {
                    dbPlans.forEach((p: any) => {
                        const netKey = p.network || 'mtn';
                        networksData[netKey] = networksData[netKey] || [];
                        networksData[netKey].push({
                            PRODUCT_ID: p.plan_id,
                            PRODUCT_AMOUNT: p.cost_price.toString(),
                            PRODUCT_NAME: p.name,
                            validity: '30 Days',
                            volume: p.name
                        });
                    });
                }
            }

            // Fallback 2: Default catalog if database and API empty
            if (Object.keys(networksData).length === 0) {
                networksData = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
            }

            for (const netKey in networksData) {
                const plans = networksData[netKey];
                let networkName = netKey.toLowerCase();
                if (networkName.includes('mtn')) networkName = 'mtn';
                else if (networkName.includes('glo')) networkName = 'glo';
                else if (networkName.includes('airtel')) networkName = 'airtel';
                else if (networkName.includes('vitel') || networkName.includes('vital')) networkName = 'vital';
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

                        const detectPlanType = (planName: string): string => {
                            const n = (planName || '').toLowerCase();
                            if (n.includes('corporate') || n.includes('cg') || n.includes('c-g')) return 'CG';
                            if (n.includes('gifting') || n.includes('gift')) return 'GIFTING';
                            if (n.includes('promo')) return 'PROMO';
                            if (n.includes('mega')) return 'MEGA';
                            if (n.includes('night')) return 'NIGHT';
                            if (n.includes('direct')) return 'DIRECT';
                            if (n.includes('coupon')) return 'COUPON';
                            if (n.includes('sme') || n.includes('s-m-e')) return 'SME';
                            return 'DIRECT';
                        };

                        const recordData: any = {
                            network: networkName,
                            plan_id: planId,
                            name: name,
                            plan_type: detectPlanType(name),
                            cost_price: costPrice,
                            selling_price: finalSellingPrice,
                            is_active: true,
                            api_vendor: vendor
                        };

                        // Check if plan exists for this network & plan_id
                        const { data: existingPlans } = await supabaseAdmin.from('data_plans')
                            .select('id')
                            .eq('network', networkName)
                            .eq('plan_id', planId);

                        const existingPlan = existingPlans?.[0];
                        let opError = null;

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

                        // Automatic Fallback if api_vendor column is missing
                        if (opError && (opError.code === '42703' || (opError.message && opError.message.includes('api_vendor')))) {
                            const fallbackData = { ...recordData };
                            delete fallbackData.api_vendor;
                            if (existingPlan) {
                                const { error: fErr } = await supabaseAdmin.from('data_plans')
                                    .update(fallbackData)
                                    .eq('id', existingPlan.id);
                                opError = fErr;
                            } else {
                                const { error: fErr } = await supabaseAdmin.from('data_plans')
                                    .insert(fallbackData);
                                opError = fErr;
                            }
                        }

                        if (!opError) {
                            globalTotalInserted++;
                            vendorBreakdown[vendor].total++;
                            const displayNetKey = networkName.toUpperCase() === 'VITAL' ? 'VITAL' : (networkName.toUpperCase() === '9MOBILE' ? '9MOBILE' : networkName.toUpperCase());
                            vendorBreakdown[vendor].networks[displayNetKey] = (vendorBreakdown[vendor].networks[displayNetKey] || 0) + 1;
                            vendorBreakdown[vendor].plans.push(recordData);
                        }
                    }
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Synced ${globalTotalInserted} data plans successfully across API vendors & networks!`,
            total: globalTotalInserted,
            vendorBreakdown: vendorBreakdown
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

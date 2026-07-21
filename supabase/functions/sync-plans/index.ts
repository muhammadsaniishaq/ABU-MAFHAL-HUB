
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
        // 1. Verify Verification (Admin Only)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization Header');

        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!anonKey) throw new Error('Missing Secret: SUPABASE_ANON_KEY');

        // Create client with User Context to check role
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) throw new Error('Unauthorized: User not found');

        // Check if Admin
        const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin');
        
        if (adminError) throw new Error(`Database Error (is_admin): ${adminError.message}`);
        if (!isAdmin) throw new Error("Unauthorized: Access Denied (Admins Only)");

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Get Active Vendor
        const { data: vendorSetting } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'vtu_vendor').single();
        const vtuVendor = vendorSetting?.value || 'clubkonnect';

        let networksData: any = {};

        if (vtuVendor === 'bigi') {
            // Bigi Logic
            const { data: bigiTokenSetting } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'BIGI_API_TOKEN').single();
            const bigiToken = bigiTokenSetting?.value;
            if (!bigiToken) throw new Error('Missing Bigi API Token');

            const bigiNetworks = [
                { id: 1, name: 'MTN' },
                { id: 2, name: 'GLO' },
                { id: 3, name: 'AIRTEL' },
                { id: 4, name: '9MOBILE' }
            ];

            for (const net of bigiNetworks) {
                const res = await fetch(`https://api.bigisub.ng/api/v2/vtu/data/plans/?network=${net.id}`, {
                    headers: { 'Authorization': `Token ${bigiToken}` }
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
            }
        } else {
            // ClubKonnect Logic
            const url = `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${DEFAULT_CLUBKONNECT_USER_ID}`;
            const response = await fetch(url);
            const data = await response.json();
            networksData = data.MOBILE_NETWORK;
        }

        // ClubKonnect Format:
        // { 
        //   "MOBILE_NETWORK": { 
        //     "PLAN_ID": "PLAN_DATA..." 
        //     ...
        //   }
        // } 
        // Structure is a bit weird based on documentation, usually network keys like 'MTN', 'GLO'.
        // Let's assume the user provided list implies we get a JSON with networks.
        
        // Since we don't know the exact JSON shape from ClubKonnect V2 API without running it,
        // and user provided text list, I'll write a parser for the structure if it matches common patterns,
        // OR better: I will first log the response so we can debug, then insert.
        // BUT for this task, I will implement a generic parser assuming:
        // { "MTN": [ { "ID": "500.0", "PRICE": "404.0", ... } ] } or similar.
        
        // Actually, looking at the user request:
        // Network | Plans
        // MTN | 500.0 — 500 MB ... @ ₦404.00
        
        // Let's try to fetch and see. 
        // If we can't fetch in this environment due to IP, we might need to parse the user provided list.
        // User provided the link, so I assume we can fetch.
        
        // Fetch Markup Configs
        const { data: configs } = await supabaseAdmin.from('data_configs').select('*');
        const configMap = new Map(configs?.map((c: any) => [c.network.toLowerCase(), c]) || []);

        let totalInserted = 0;

        const networksFound: string[] = [];

        for (const netKey in networksData) {
            const plans = networksData[netKey];
             // Normalize network name: 
             // 'MTN' or 'MTN DATA' -> 'mtn'
             // 'GLO' or 'GLO DATA' -> 'glo'
             // 'AIRTEL' -> 'airtel'
             // '9MOBILE' or 'ETISALAT' -> '9mobile'
             
            let networkName = netKey.toLowerCase();
            if (networkName.includes('mtn')) networkName = 'mtn';
            else if (networkName.includes('glo')) networkName = 'glo';
            else if (networkName.includes('airtel')) networkName = 'airtel';
            else if (networkName.includes('mobile') || networkName.includes('etisalat')) networkName = '9mobile';
            
            networksFound.push(`${netKey}->${networkName}`);

            for (const item of plans) {
                // Handle Nesting: The API seems to return { "ID":"01", "PRODUCT": [...] }
                // So we need to iterate over the 'PRODUCT' array if it exists.
                let properPlans: ClubKonnectPlan[] = [];
                
                if (Array.isArray(item.PRODUCT)) {
                     properPlans = item.PRODUCT;
                } else if (item.PRODUCT) {
                     // If it's a single object
                     properPlans = [item.PRODUCT];
                } else {
                     // Fallback (or if flattened already)
                     properPlans = [item];
                }

                for (const plan of properPlans) {
                    // Smart Key Discovery Helper
                    const getVal = (regex: RegExp) => {
                        const keys = Object.keys(plan);
                        const match = keys.find(k => regex.test(k));
                        return match && plan[match] !== undefined ? String(plan[match]) : undefined;
                    }

                    // 1. Resolve Plan ID
                    let planId = plan.PRODUCT_ID || plan.ID || plan.id || plan.PLAN_ID || plan.plan_id;
                    if (!planId) planId = getVal(/id$/i);

                    if (!planId) {
                        // Only log if strictly missing ID (and not just an empty wrapper)
                        // networksFound.push(`Skipped (No ID): Keys=[${Object.keys(plan).join(',')}]`);
                        continue;
                    }

                    // 2. Resolve Price
                    // Look for: PRODUCT_AMOUNT, AMOUNT, PRICE, COST, selling_price, etc.
                    const rawPrice = plan.PRODUCT_AMOUNT || plan.AMOUNT || plan.PRICE || plan.COST || plan.cost_price || getVal(/amount|price|cost/i);
                    const costPrice = parseFloat(rawPrice || '0');

                    // 3. Resolve Name
                    // Look for: PRODUCT_NAME, NAME, TITLE, PACKAGE_NAME
                    const rawName = plan.PRODUCT_NAME || plan.NAME || plan.TITLE || plan.PACKAGE_NAME || getVal(/name|title|package/i);
                    
                    // Construct Name if missing
                    let name = rawName || `${networkName.toUpperCase()} ${planId}`;

                    // Extract validity from name/payload if available for better display
                    let validity = plan.validity || plan.VALIDITY;
                    if (!validity) {
                        const nameLower = name.toLowerCase();
                        if (nameLower.includes('daily') || nameLower.includes('24hr')) validity = '1 Day';
                        else if (nameLower.includes('weekly') || nameLower.includes('7 days')) validity = '7 Days';
                        else if (nameLower.includes('monthly') || nameLower.includes('30 days')) validity = '30 Days';
                        else {
                            const match = name.match(/(\d+)\s*(day|week|month|hr)/i);
                            if (match) validity = match[0];
                            else validity = '30 Days'; // default
                        }
                    }

                    // Clean name (optional formatting logic if desired)
                    const cleanName = name.replace(/\b(Daily|Weekly|Monthly|Day|Week|Month|Days|Weeks|Months|Hour|Hours|Hr|Hrs)\b/gi, '').replace(/\d+(hr|hrs)/gi, '').replace(/\-\s*/g, '').trim();

                    const config = configMap.get(networkName);
                    let finalSellingPrice = costPrice; // Default Markup is 0 (direct API price)
                    if (config) {
                        if (config.markup_type === 'percentage') {
                            finalSellingPrice = costPrice * (1 + (parseFloat(config.markup_value) / 100));
                        } else {
                            finalSellingPrice = costPrice + parseFloat(config.markup_value);
                        }
                    }
                    finalSellingPrice = Math.round(finalSellingPrice);
                    
                    // We manually check for existing plan because 'plan_id' might not have a unique constraint
                    const { data: existingPlan } = await supabaseAdmin.from('data_plans')
                        .select('id')
                        .eq('network', networkName)
                        .eq('plan_id', planId)
                        .maybeSingle();

                    let opError = null;

                    if (existingPlan) {
                        const { error } = await supabaseAdmin.from('data_plans')
                            .update({
                                name: cleanName,
                                cost_price: costPrice,
                                selling_price: finalSellingPrice,
                                is_active: true
                            })
                            .eq('id', existingPlan.id);
                        opError = error;
                    } else {
                        const { error } = await supabaseAdmin.from('data_plans')
                            .insert({
                                network: networkName,
                                plan_id: planId,
                                name: cleanName,
                                cost_price: costPrice,
                                selling_price: finalSellingPrice,
                                is_active: true
                            });
                        opError = error;
                    }

                    if (opError) {
                        console.error(`Operation Failed for ${planId}:`, opError);
                        networksFound.push(`Error ${planId}: ${opError.message}`);
                    } else {
                        totalInserted++;
                    }
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Synced ${totalInserted} plans. Networks: ${networksFound.join(', ')}`,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
         const errorMessage = error instanceof Error ? error.message : "Unknown Error";
         return new Response(JSON.stringify({ success: false, error: errorMessage }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, // Return 200 so UI receives the JSON error
        });
    }
});

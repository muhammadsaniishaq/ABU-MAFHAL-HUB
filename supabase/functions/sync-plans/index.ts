
import { createClient } from "@supabase/supabase-js";
import { CLUBKONNECT_USER_ID, CLUBKONNECT_API_KEY as _CLUBKONNECT_API_KEY } from "../_shared/clubkonnect.ts";

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

        const url = `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
        const response = await fetch(url);
        const data = await response.json();

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
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const networksData = data.MOBILE_NETWORK;
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
                    const name = rawName || `${networkName.toUpperCase()} ${planId}`;

                    // Debugging removed for production


                    const { data: existing } = await supabaseAdmin.from('data_plans').select('selling_price').eq('plan_id', planId).single();
                    
                    let finalSellingPrice = costPrice + 50; // Default Markup
                    if (existing) {
                        finalSellingPrice = existing.selling_price;
                    }
                    
                    const { error: upsertError } = await supabaseAdmin.from('data_plans').upsert({
                            network: networkName,
                            plan_id: planId,
                            name: name,
                            cost_price: costPrice,
                            selling_price: finalSellingPrice,
                            is_active: true
                    }, { onConflict: 'plan_id' });

                    if (upsertError) {
                        console.error(`Insert Failed for ${planId}:`, upsertError);
                        networksFound.push(`Error ${planId}: ${upsertError.message}`);
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

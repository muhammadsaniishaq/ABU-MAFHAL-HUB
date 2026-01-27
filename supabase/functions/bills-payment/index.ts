import { createClient } from "@supabase/supabase-js";
import { ClubKonnectClient, type ClubKonnectResponse } from "../_shared/clubkonnect.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Bills Payment Request: ${req.method} ${url.pathname}`);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // 1. Health Check
    if (req.method === 'GET') {
        return new Response(JSON.stringify({ 
            status: "online", 
            message: "Bills Payment service is ready" 
        }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200 
        });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const payload = await req.json();
        const { type, ...data } = payload;
        
        console.log(`[Bills] Init Processing: Type=${type}, Data=${JSON.stringify(data)}`);

        // Get Auth Context
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error("[Bills] Missing Authorization Header");
            return new Response(JSON.stringify({ success: false, error: "Authentication required" }), { 
                status: 200, 
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // 1. Identify User
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
             console.error("[Bills] Auth verification failed:", userError?.message);
             return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { 
                 status: 200, 
                 headers: { ...corsHeaders, "Content-Type": "application/json" } 
             });
        }
        const userId = user.id;
        console.log(`[Bills] User Authenticated: ${userId}`);

        // 2. Determine Pricing & Parameters
        let amountToCharge = 0;
        const client = new ClubKonnectClient();
        const requestId = data.requestId || `REQ-${Date.now()}`;

        // Network Mapping
        const getNetworkCode = (net: string): '01' | '02' | '03' | '04' | string => {
            const map: Record<string, '01' | '02' | '03' | '04'> = { 'mtn': '01', 'glo': '02', '9mobile': '03', 'airtel': '04' };
            return map[net?.toLowerCase()] || net;
        };
        const networkCode = getNetworkCode(data.network);

        let providerParams: Record<string, string | number> = {};

        if (type === 'data') {
            const { data: plan, error: planError } = await supabaseClient
                .from('data_plans')
                .select('*')
                .eq('plan_id', data.planId)
                .single();
            
            if (planError || !plan) throw new Error(`Invalid Data Plan: ${data.planId}`);
            
            amountToCharge = plan.selling_price;
            providerParams = { network: networkCode, phone: data.phone, planId: plan.plan_id };
        } else if (type === 'airtime') {
            amountToCharge = Number(data.amount);
            if (amountToCharge < 50) throw new Error("Minimum Airtime is N50");

            // Airtime Discount Check
            const { data: config } = await supabaseClient
                .from('airtime_configs')
                .select('sell_percentage')
                .eq('network', networkCode === '01' ? 'MTN' : networkCode === '02' ? 'GLO' : networkCode === '03' ? '9MOBILE' : 'AIRTEL')
                .maybeSingle();
            
            if (config?.sell_percentage) {
                 amountToCharge -= (amountToCharge * (Number(config.sell_percentage) / 100));
            }

             providerParams = { network: networkCode, phone: data.phone, amount: Number(data.amount) };
        } else {
             throw new Error(`Unsupported service type: ${type}`);
        }

        console.log(`[Bills] Charging: ₦${amountToCharge} for ${type} to ${data.phone}`);

        // 3. Deduct Balance
        const rpcClient = createClient(supabaseUrl, supabaseServiceRoleKey);
        const { data: newBalance, error: deductError } = await rpcClient.rpc('deduct_balance', {
            user_id: userId,
            amount: amountToCharge
        });

        if (deductError) {
             console.error("[Bills] Balance Deduction Failed:", deductError.message);
             return new Response(JSON.stringify({ success: false, error: deductError.message || "Insufficient balance" }), {
                 headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                 status: 200
             });
        }
        console.log(`[Bills] Balance Deducted. New Balance: ₦${newBalance}`);

        // 4. Call Provider (ClubKonnect)
        let result: ClubKonnectResponse;
        try {
            if (type === 'airtime') {
                result = await client.buyAirtime(providerParams.network as '01' | '02' | '03' | '04', providerParams.phone as string, providerParams.amount as number, requestId);
            } else if (type === 'data') {
                result = await client.buyData(providerParams.network as string, providerParams.phone as string, providerParams.planId as string, requestId);
            } else {
                throw new Error("Invalid service type reached execution");
            }
            
            console.log(`[Bills] Provider Result: ${JSON.stringify(result)}`);

            if (result && (result.status === 'ORDER_RECEIVED' || result.status === 'ORDER_COMPLETED' || result.status === 'SUCCESS')) {
                // All good
            } else {
                 throw new Error(result?.message || result?.status || "Provider API Failure");
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("[Bills] Execution Failed, Refund Initiating:", errorMessage);
            
            // 5. Refund
            await rpcClient.rpc('deduct_balance', {
                user_id: userId,
                amount: -amountToCharge
            });
            
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Service Failure: ${errorMessage}. Wallet Refunded.` 
            }), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                status: 200 
            });
        }

        return new Response(JSON.stringify({ success: true, data: result, requestId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 200
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[Bills] Global Error:", errorMessage);
        return new Response(JSON.stringify({ 
            success: false, 
            error: errorMessage 
        }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 200 
        });
    }
});

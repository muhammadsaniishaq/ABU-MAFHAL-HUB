import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_URL = "https://9boost.me/api/v2";

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uagcxrtdqttayulvgpwg.supabase.co';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Server Configuration Error");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Authenticate User
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Parse Request
        const body = await req.json();
        const { action } = body;

        // Fetch API Key
        let API_KEY = Deno.env.get('NINE_BOOST_API_KEY');
        if (!API_KEY) {
            const { data: secret } = await supabaseAdmin.from('system_secrets').select('value').eq('key', 'NINE_BOOST_API_KEY').single();
            if (secret && secret.value) {
                API_KEY = secret.value;
            }
        }
        if (!API_KEY) {
            throw new Error("SMM Provider Configuration Error");
        }

        const getMarkup = async () => {
            const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'smm_markup_percentage').single();
            return data && data.value ? parseFloat(data.value) : 20; // Default 20%
        };

        if (action === 'services') {
            // Fetch Services
            const formData = new URLSearchParams();
            formData.append('key', API_KEY);
            formData.append('action', 'services');

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            const markup = await getMarkup();
            
            // Apply markup
            const servicesWithMarkup = data.map((srv: any) => {
                const rate = parseFloat(srv.rate);
                const finalRate = rate + (rate * (markup / 100));
                return {
                    ...srv,
                    original_rate: rate,
                    rate: finalRate.toFixed(2)
                };
            });

            return new Response(JSON.stringify({ services: servicesWithMarkup }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        if (action === 'place_order') {
            const { serviceId, link, quantity, expectedPrice } = body;
            
            if (!serviceId || !link || !quantity) {
                return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 1. Verify Price & Service
            const srvFormData = new URLSearchParams();
            srvFormData.append('key', API_KEY);
            srvFormData.append('action', 'services');
            const srvRes = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: srvFormData.toString()
            });
            const allServices = await srvRes.json();
            const targetService = allServices.find((s: any) => String(s.service) === String(serviceId));
            
            if (!targetService) {
                return new Response(JSON.stringify({ error: "Invalid Service ID" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const q = parseInt(quantity);
            if (q < parseInt(targetService.min) || q > parseInt(targetService.max)) {
                return new Response(JSON.stringify({ error: `Quantity must be between ${targetService.min} and ${targetService.max}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const markup = await getMarkup();
            const costRate = parseFloat(targetService.rate);
            const userRate = costRate + (costRate * (markup / 100));
            const calculatedUserPrice = (userRate / 1000) * q;
            const totalCostPrice = (costRate / 1000) * q;

            // 🛡️ Security Guard: Authoritative server price calculation. Never trust client-submitted expectedPrice.
            const finalPrice = Math.max(0.01, Math.round(calculatedUserPrice * 100) / 100);

            // 2. Atomic Wallet Balance Deduction (Prevents Concurrency Double-Spending)
            const { data: deductResult, error: deductError } = await supabaseAdmin.rpc('deduct_balance', {
                user_id: user.id,
                amount: finalPrice
            });

            if (deductError || (deductResult && deductResult.success === false)) {
                const errMsg = deductError?.message || deductResult?.error || 'Insufficient wallet balance.';
                return new Response(JSON.stringify({ error: errMsg }), { 
                    status: 200, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // 3. Place Order with API
            let orderResult: any = null;
            try {
                const orderData = new URLSearchParams();
                orderData.append('key', API_KEY);
                orderData.append('action', 'add');
                orderData.append('service', String(serviceId));
                orderData.append('link', link);
                orderData.append('quantity', String(q));
                
                const orderRes = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: orderData.toString()
                });
                orderResult = await orderRes.json();
            } catch (fetchErr: any) {
                console.error("[smm-api] Order dispatch exception:", fetchErr);
                orderResult = { error: fetchErr.message || "Failed to reach SMM provider" };
            }

            if (!orderResult || orderResult.error) {
                // 🛡️ Fail-Safe Auto-Refund: Provider failed, refund balance immediately
                await supabaseAdmin.rpc('credit_balance', {
                    user_id: user.id,
                    amount: finalPrice
                });

                await supabaseAdmin.from('transactions').insert({
                    user_id: user.id,
                    type: 'refund',
                    amount: finalPrice,
                    status: 'success',
                    reference: `REF-SMM-${Date.now()}`,
                    description: `Auto-Refund: Social Boost Order Failed (${targetService.name})`
                });

                let errorMsg = orderResult?.error || "We are temporarily unable to process this order. Please try again later.";
                const lowerError = String(errorMsg).toLowerCase();
                
                if (lowerError.includes('insufficient balance') || lowerError.includes('balance') || lowerError.includes('funds') || lowerError.includes('child panel')) {
                    errorMsg = "Service is currently undergoing maintenance. Please try again later.";
                } else if (lowerError.includes('invalid') || lowerError.includes('link')) {
                    errorMsg = "The link you provided seems to be invalid. Please check and try again.";
                }

                return new Response(JSON.stringify({ error: errorMsg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 4. Log Successful Transaction
            const txRef = `SMM-${orderResult.order}-${Date.now()}`;
            await supabaseAdmin.from('transactions').insert({
                user_id: user.id,
                type: 'social_boost',
                amount: finalPrice,
                status: 'success',
                reference: txRef,
                description: `Social Boost Order #${orderResult.order} (${targetService.name})`
            });

            // Save to smm_orders table if present
            try {
                await supabaseAdmin.from('smm_orders').insert({
                    user_id: user.id,
                    order_id: String(orderResult.order),
                    service_id: String(serviceId),
                    service_name: targetService.name,
                    link: link,
                    quantity: q,
                    price: finalPrice,
                    status: 'Pending',
                    created_at: new Date().toISOString()
                });
            } catch (tblErr) {
                console.warn("smm_orders table insert skipped:", tblErr);
            }

            return new Response(JSON.stringify({ 
                success: true, 
                message: "Order placed successfully",
                order: orderResult.order,
                reference: txRef,
                price: finalPrice,
                newBalance
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        if (action === 'status') {
            const { orderId } = body;
            const formData = new URLSearchParams();
            formData.append('key', API_KEY);
            formData.append('action', 'status');
            formData.append('order', String(orderId));

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });
            const data = await res.json();
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Function Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

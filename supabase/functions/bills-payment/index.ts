import { createClient } from "@supabase/supabase-js";
import { ClubKonnectClient, type ClubKonnectResponse } from "../_shared/clubkonnect.ts";
import { BigiClient } from "../_shared/bigi.ts";
import { BilalsadasubClient } from "../_shared/bilalsadasub.ts";

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

        // Fetch dynamic secrets from Admin API Vault
        const rpcClient = createClient(supabaseUrl, supabaseServiceRoleKey);
        const { data: secretsData } = await rpcClient
            .from('system_secrets')
            .select('key, value')
            .in('key', ['CLUBKONNECT_USER_ID', 'CLUBKONNECT_API_KEY', 'BIGI_API_TOKEN', 'BIGI_API_PIN', 'BILALSADASUB_TOKEN', 'BILALSADASUB_API_TOKEN', 'BILAL_TOKEN', 'BILAL_API_TOKEN', 'VITAL_API_TOKEN', 'VITAL_TOKEN', 'VITAL_KEY']);
            
        const ckUserId = secretsData?.find(s => s.key === 'CLUBKONNECT_USER_ID')?.value;
        const ckApiKey = secretsData?.find(s => s.key === 'CLUBKONNECT_API_KEY')?.value;
        const bigiToken = secretsData?.find(s => s.key === 'BIGI_API_TOKEN')?.value;
        const bigiPin = secretsData?.find(s => s.key === 'BIGI_API_PIN')?.value;
        const bilalToken = secretsData?.find(s => s.key === 'BILALSADASUB_TOKEN' || s.key === 'BILALSADASUB_API_TOKEN' || s.key === 'BILAL_TOKEN' || s.key === 'BILAL_API_TOKEN')?.value;
        const vitalToken = secretsData?.find(s => s.key === 'VITAL_API_TOKEN' || s.key === 'VITAL_TOKEN' || s.key === 'VITAL_KEY')?.value || bilalToken;

        // Fetch VTU vendor from app_settings
        const { data: settingsData } = await rpcClient
            .from('app_settings')
            .select('key, value')
            .eq('key', 'vtu_vendor');
        let vtuVendor = (settingsData && settingsData.length > 0 && settingsData[0].value) ? settingsData[0].value.toLowerCase() : '';

        // Allow explicit override via request body vendor parameter if supplied
        if (data && data.vendor) {
            vtuVendor = data.vendor.toLowerCase();
        }

        // Smart fail-safe fallback: If no vendor explicitly saved in app_settings, pick configured vendor from system_secrets
        if (!vtuVendor) {
            if (bilalToken) vtuVendor = 'bilalsadasub';
            else if (bigiToken) vtuVendor = 'bigi';
            else vtuVendor = 'clubkonnect';
        }

        // Handle Airtime to Cash actions directly before balance deduction
        if (type === 'cash_rates' || type === 'cash_step1' || type === 'cash_step2' || type === 'cash_step3') {
            const activeCashToken = bilalToken || vitalToken;
            if (!activeCashToken) {
                console.error("[Bills] BILALSADASUB_TOKEN / VITAL_TOKEN is missing in system_secrets table");
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: "Bilalsadasub / Vital Sub API Token missing. Admin must configure API Token in Settings -> API Vault." 
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }
            const bilalClient = new BilalsadasubClient(activeCashToken);

            if (type === 'cash_rates') {
                const res = await fetch('https://bilalsadasub.com/api/v1/airtime-to-cash/rates');
                const data = await res.json();
                return new Response(JSON.stringify({ success: true, data }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            if (type === 'cash_step1') {
                const { network, amount, phone } = data;
                const res = await bilalClient.airtimeToCashStep1(network, Number(amount), phone);
                return new Response(JSON.stringify({ success: true, data: res }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            if (type === 'cash_step2') {
                const { transid, otp } = data;
                const res = await bilalClient.airtimeToCashStep2(transid, otp);
                return new Response(JSON.stringify({ success: true, data: res }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            if (type === 'cash_step3') {
                const { network, amount, phone } = data;
                const step3Res = await bilalClient.airtimeToCashStep3(network, Number(amount), phone);
                
                if (step3Res.status === 'success' || step3Res.status === 'completed') {
                    const creditedAmount = Number(step3Res.credited_amount || amount * 0.8);
                    await rpcClient.rpc('deduct_balance', {
                        user_id: userId,
                        amount: -creditedAmount
                    });

                    await rpcClient.from('wallet_transactions').insert({
                        user_id: userId,
                        type: 'credit',
                        amount: creditedAmount,
                        status: 'completed',
                        reference: step3Res.transid || `AC_${Date.now()}`,
                        description: `Airtime to Cash (${phone}) -> +₦${creditedAmount.toLocaleString()}`
                    });
                }

                return new Response(JSON.stringify({ success: true, data: step3Res }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }
        }

        // 2. Determine Pricing & Parameters
        let amountToCharge = 0;
        const client = new ClubKonnectClient(ckUserId, ckApiKey);
        const requestId = data.requestId || `REQ-${Date.now()}`;

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

            const { data: config } = await supabaseClient
                .from('airtime_configs')
                .select('sell_percentage')
                .eq('network', networkCode === '01' ? 'MTN' : networkCode === '02' ? 'GLO' : networkCode === '03' ? '9MOBILE' : 'AIRTEL')
                .maybeSingle();
            
            if (config?.sell_percentage) {
                 amountToCharge -= (amountToCharge * (Number(config.sell_percentage) / 100));
            }

             providerParams = { network: networkCode, phone: data.phone, amount: Number(data.amount) };
        } else if (type === 'smile') {
             amountToCharge = Number(data.amount);
             if (amountToCharge < 100) throw new Error("Invalid Smile Amount");
             providerParams = { network: 'smile-direct', phone: data.phone, planId: data.planId };
        } else if (type === 'education') {
             amountToCharge = Number(data.amount) * (Number(data.quantity) || 1);
             if (amountToCharge < 500) throw new Error("Invalid Education Amount");
             providerParams = { examType: data.examType, phone: data.phone, profileId: data.profileId, quantity: data.quantity || 1 };
        } else if (type === 'get_plans') {
             // Just pass through
        } else {
             throw new Error(`Unsupported service type: ${type}`);
        }

        console.log(`[Bills] Charging: ₦${amountToCharge} for ${type} to ${data.phone}`);

        if (type !== 'get_plans') {
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
        }

        // 4. Call Provider (ClubKonnect, Bigi, Bilalsadasub, or Vital Sub)
        let result: any;
        try {
            if (type === 'get_plans') {
                if (vtuVendor === 'bilalsadasub') {
                    const netName = (data.network || 'MTN').toString().toUpperCase();
                    const res = await fetch(`https://bilalsadasub.com/api/v1/plans/data?network=${netName}`);
                    const plansData = await res.json();
                    return new Response(JSON.stringify({ success: true, data: plansData.data || plansData }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                        status: 200
                    });
                } else if (vtuVendor === 'bigi') {
                    if (!bigiToken) throw new Error("Bigi API Token missing in settings");
                    const bigiClient = new BigiClient(bigiToken, bigiPin || '');
                    
                    const netLower = data.network.toLowerCase();
                    let netId = 1;
                    if (netLower.includes('glo')) netId = 2;
                    if (netLower.includes('airtel')) netId = 3;
                    if (netLower.includes('9mobile') || netLower.includes('etisalat')) netId = 4;
                    
                    const res = await fetch(`https://api.bigisub.ng/api/v2/vtu/data/plans/?network=${netId}`, {
                        headers: { 'Authorization': `Token ${bigiToken}` }
                    });
                    const plansData = await res.json();
                    if (!plansData.success) throw new Error(plansData.message || 'Failed to fetch Bigi plans');
                    
                    return new Response(JSON.stringify({ success: true, data: plansData.data }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                        status: 200
                    });
                } else {
                    const res = await fetch(`https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${ckUserId}`);
                    const plansData = await res.json();
                    return new Response(JSON.stringify({ success: true, data: plansData }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                        status: 200
                    });
                }
            }

            if (type === 'airtime' || type === 'data') {
                let vendorOrder: string[] = [];
                if (vtuVendor && vtuVendor.includes(',')) {
                    vendorOrder = vtuVendor.split(',').map((v: string) => v.trim()).filter(Boolean);
                } else if (vtuVendor === 'bigi') {
                    vendorOrder = ['bigi', 'bilalsadasub', 'clubkonnect'];
                } else if (vtuVendor === 'clubkonnect') {
                    vendorOrder = ['clubkonnect', 'bilalsadasub', 'bigi'];
                } else {
                    vendorOrder = ['bilalsadasub', 'bigi', 'clubkonnect'];
                }

                let lastError: any = null;
                for (const vendor of vendorOrder) {
                    try {
                        console.log(`[Bills] Trying VTU Vendor: ${vendor}`);
                        if (vendor === 'bilalsadasub' && bilalToken) {
                            const bilalClient = new BilalsadasubClient(bilalToken);
                            if (type === 'airtime') {
                                result = await bilalClient.buyAirtime(providerParams.network as string, providerParams.phone as string, providerParams.amount as number, requestId);
                            } else {
                                result = await bilalClient.buyData(providerParams.network as string, providerParams.phone as string, providerParams.planId as string, requestId);
                            }
                        } else if (vendor === 'bigi' && bigiToken && bigiPin) {
                            const bigiClient = new BigiClient(bigiToken, bigiPin);
                            if (type === 'airtime') {
                                result = await bigiClient.buyAirtime(providerParams.network as string, providerParams.phone as string, providerParams.amount as number, requestId);
                            } else {
                                result = await bigiClient.buyData(providerParams.network as string, providerParams.phone as string, providerParams.planId as string, requestId);
                            }
                        } else if (vendor === 'clubkonnect' && ckUserId && ckApiKey) {
                            if (type === 'airtime') {
                                result = await client.buyAirtime(providerParams.network as '01' | '02' | '03' | '04', providerParams.phone as string, providerParams.amount as number, requestId);
                            } else {
                                result = await client.buyData(providerParams.network as string, providerParams.phone as string, providerParams.planId as string, requestId);
                            }
                        } else {
                            continue;
                        }

                        if (result && (result.status === 'ORDER_RECEIVED' || result.status === 'ORDER_COMPLETED' || result.status === 'SUCCESS')) {
                            console.log(`[Bills] VTU Transaction Succeeded via: ${vendor}`);
                            break;
                        }
                    } catch (err: any) {
                        console.warn(`[Bills] Vendor ${vendor} failed: ${err.message}. Trying next fallback provider...`);
                        lastError = err;
                    }
                }

                if (!result && lastError) {
                    throw lastError;
                }
            } else if (type === 'smile') {
                result = await client.buySmile(providerParams.network as string, providerParams.planId as string, providerParams.phone as string, requestId);
            } else if (type === 'education') {
                result = await client.buyEPin(providerParams.examType as string, providerParams.phone as string, requestId, providerParams.profileId as string);
            } else if (type === 'recharge_pin_purchase') {
                if (bigiToken && bigiPin) {
                    const bigiClient = new BigiClient(bigiToken, bigiPin);
                    result = await bigiClient.buyRechargePin(providerParams.planId || 1, providerParams.quantity || 1, providerParams.businessName || 'ABU MAFHAL VTU', requestId);
                } else {
                    throw new Error("Bigi API credentials not configured for recharge pins");
                }
            } else if (type === 'recharge_pin_plans') {
                if (bigiToken && bigiPin) {
                    const bigiClient = new BigiClient(bigiToken, bigiPin);
                    const plansData = await bigiClient.getRechargePinPlans();
                    return new Response(JSON.stringify({ success: true, data: plansData }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 200
                    });
                } else {
                    throw new Error("Bigi API credentials not configured");
                }
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

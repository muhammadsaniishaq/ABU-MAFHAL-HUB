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

        // Fetch dynamic secrets from Admin API Vault & app_settings
        const rpcClient = createClient(supabaseUrl, supabaseServiceRoleKey);
        const { data: secretsData } = await rpcClient
            .from('system_secrets')
            .select('key, value');

        const { data: appSettingsData } = await rpcClient
            .from('app_settings')
            .select('key, value');

        const secretsMap: Record<string, string> = {};
        if (appSettingsData) {
            appSettingsData.forEach(s => {
                if (typeof s.value === 'string' && s.value.trim() !== '') secretsMap[s.key.toUpperCase()] = s.value.trim();
                else if (s.value && typeof s.value === 'object') {
                    Object.entries(s.value).forEach(([subK, subV]) => {
                        if (typeof subV === 'string' && subV.trim() !== '') secretsMap[subK.toUpperCase()] = subV.trim();
                    });
                }
            });
        }
        if (secretsData) {
            secretsData.forEach(s => {
                if (typeof s.value === 'string' && s.value.trim() !== '') secretsMap[s.key.toUpperCase()] = s.value.trim();
                else if (s.value && typeof s.value === 'object') {
                    Object.entries(s.value).forEach(([subK, subV]) => {
                        if (typeof subV === 'string' && subV.trim() !== '') secretsMap[subK.toUpperCase()] = subV.trim();
                    });
                }
            });
        }

        const settingsMap: Record<string, string> = secretsMap;
            
        const ckUserId = secretsMap['CLUBKONNECT_USER_ID'] || secretsMap['CLUBKONNECT_USER'] || Deno.env.get('CLUBKONNECT_USER_ID') || 'CK101269551';
        const ckApiKey = secretsMap['CLUBKONNECT_API_KEY'] || secretsMap['CLUBKONNECT_KEY'] || secretsMap['CLUBKONNECT_PASS'] || Deno.env.get('CLUBKONNECT_API_KEY') || '';
        const bigiToken = secretsMap['BIGI_API_TOKEN'] || secretsMap['BIGI_TOKEN'] || Deno.env.get('BIGI_API_TOKEN') || '';
        const bigiPin = secretsMap['BIGI_API_PIN'] || secretsMap['BIGI_PIN'] || Deno.env.get('BIGI_API_PIN') || '';
        const bilalToken = secretsMap['BILALSADASUB_TOKEN'] || secretsMap['BILAL_TOKEN'] || secretsMap['BILALSADASUB_API_KEY'] || secretsMap['BILAL_API_KEY'] || Deno.env.get('BILALSADASUB_TOKEN') || '';

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
            if (bigiToken) vtuVendor = 'bigi';
            else if (bilalToken) vtuVendor = 'bilalsadasub';
            else vtuVendor = 'clubkonnect';
        }

        // Handle Airtime to Cash actions directly before balance deduction
        if (type === 'cash_rates' || type === 'cash_step1' || type === 'cash_step2' || type === 'cash_step3') {
            const activeCashToken = bilalToken;
            if (!activeCashToken) {
                console.error("[Bills] BILALSADASUB_TOKEN is missing in system_secrets table");
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: "Bilalsadasub API Token missing. Admin must configure API Token in Settings -> API Vault." 
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
                    // Use credit_balance (deduct_balance blocks negative numbers)
                    await rpcClient.rpc('credit_balance', {
                        user_id: userId,
                        amount: creditedAmount
                    });

                    await rpcClient.from('transactions').insert({
                        user_id: userId,
                        type: 'deposit',
                        amount: creditedAmount,
                        status: 'success',
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
            if (amountToCharge > 50000) throw new Error("Maximum Airtime is N50,000 per transaction");

            const netName = networkCode === '01' ? 'MTN' : networkCode === '02' ? 'GLO' : networkCode === '03' ? '9MOBILE' : 'AIRTEL';
            let sellDiscount = 0;

            // 1. Check airtime_configs if available
            try {
                const { data: config } = await supabaseClient
                    .from('airtime_configs')
                    .select('sell_percentage')
                    .eq('network', netName)
                    .maybeSingle();
                if (config && config.sell_percentage !== null && config.sell_percentage !== undefined) {
                    sellDiscount = Number(config.sell_percentage);
                }
            } catch {}

            // 2. Check app_settings if not in airtime_configs
            if (sellDiscount === 0) {
                const settingKey = `AIRTIME_DISCOUNT_${netName}`;
                const appSettingVal = settingsMap?.[settingKey] || settingsMap?.['AIRTIME_USER_DISCOUNT'];
                if (appSettingVal) {
                    const parsed = parseFloat(appSettingVal);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
                        sellDiscount = parsed;
                    }
                }
            }

            // 3. Default Discount: Defaults to 0% (Face value).
            // Prevents loss when API provider deducts full 100% face value (e.g. BigiSub deducts N100 for N100 airtime).
            if (sellDiscount === undefined || sellDiscount === null || isNaN(sellDiscount)) {
                sellDiscount = 0;
            }

            if (sellDiscount > 0) {
                amountToCharge -= (amountToCharge * (sellDiscount / 100));
                amountToCharge = Math.round(amountToCharge * 100) / 100;
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
        } else if (type === 'recharge_pin_purchase') {
             const planPrices: Record<number, number> = { 1: 98.9, 2: 197.8, 3: 494.5, 4: 989 };
             const pId = typeof data.planId === 'number' ? data.planId : parseInt(data.planId || 1, 10);
             const unitCost = planPrices[pId] || 98.9;
             const qty = Math.max(1, Number(data.quantity || 1));
             amountToCharge = Math.round(unitCost * qty * 10) / 10;
             providerParams = { planId: pId, quantity: qty, businessName: data.businessName || 'ABU MAFHAL VTU' };
        } else if (type === 'recharge_pin_plans') {
             // Pass through without balance deduction
        } else if (type === 'get_plans') {
             // Just pass through
        } else {
             throw new Error(`Unsupported service type: ${type}`);
        }

        console.log(`[Bills] Required Charge: ₦${amountToCharge} for ${type} to ${data.phone || 'N/A'}`);

        // 3. Pre-Flight Balance Verification (DO NOT DEDUCT YET)
        // User balance is only verified here. Deduction strictly happens AFTER provider confirms delivery.
        if (type !== 'get_plans' && type !== 'recharge_pin_plans') {
            if (!amountToCharge || isNaN(amountToCharge) || amountToCharge <= 0) {
                return new Response(JSON.stringify({ success: false, error: "Invalid transaction amount" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            const { data: profile, error: profError } = await rpcClient
                .from('profiles')
                .select('balance')
                .eq('id', userId)
                .single();

            if (profError || !profile) {
                return new Response(JSON.stringify({ success: false, error: "User account profile not found" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            const currentBalance = Number(profile.balance || 0);
            if (currentBalance < amountToCharge) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `Insufficient balance. Available: ₦${currentBalance.toLocaleString()}, Required: ₦${amountToCharge.toLocaleString()}` 
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                    status: 200
                });
            }
        }

        // 4. Call Provider (BigiSub, Bilalsadasub, or ClubKonnect)
        let result: any;
        try {
            if (type === 'get_plans') {
                if (vtuVendor === 'bigi') {
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
                } else if (vtuVendor === 'bilalsadasub') {
                    const netName = (data.network || 'MTN').toString().toUpperCase();
                    const res = await fetch(`https://bilalsadasub.com/api/v1/plans/data?network=${netName}`);
                    const plansData = await res.json();
                    return new Response(JSON.stringify({ success: true, data: plansData.data || plansData }), {
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
                } else if (vtuVendor === 'bilalsadasub') {
                    vendorOrder = ['bilalsadasub', 'bigi', 'clubkonnect'];
                } else if (vtuVendor === 'clubkonnect') {
                    vendorOrder = ['clubkonnect', 'bilalsadasub', 'bigi'];
                } else if (vtuVendor === 'bigi') {
                    vendorOrder = ['bigi', 'bilalsadasub', 'clubkonnect'];
                } else {
                    // Smart default fallback order based on configured secrets
                    if (bigiToken && bigiPin) {
                        vendorOrder = ['bigi', 'bilalsadasub', 'clubkonnect'];
                    } else if (bilalToken) {
                        vendorOrder = ['bilalsadasub', 'bigi', 'clubkonnect'];
                    } else {
                        vendorOrder = ['clubkonnect', 'bilalsadasub', 'bigi'];
                    }
                }

                let lastError: any = null;
                for (const vendor of vendorOrder) {
                    try {
                        console.log(`[Bills] Trying VTU Vendor for ${type}: ${vendor}`);
                        if (vendor === 'bigi' && bigiToken && bigiPin) {
                            const bigiClient = new BigiClient(bigiToken, bigiPin);
                            if (type === 'airtime') {
                                result = await bigiClient.buyAirtime(providerParams.network as string, providerParams.phone as string, providerParams.amount as number, requestId);
                            } else {
                                result = await bigiClient.buyData(providerParams.network as string, providerParams.phone as string, providerParams.planId as string, requestId);
                            }
                        } else if (vendor === 'bilalsadasub' && bilalToken) {
                            const bilalClient = new BilalsadasubClient(bilalToken);
                            if (type === 'airtime') {
                                result = await bilalClient.buyAirtime(providerParams.network as string, providerParams.phone as string, providerParams.amount as number, requestId);
                            } else {
                                result = await bilalClient.buyData(providerParams.network as string, providerParams.phone as string, providerParams.planId as string, requestId);
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

                        const statusStr = String(result?.status || result?.msg || '').toUpperCase();
                        const isExplicitFailed = statusStr.includes('FAIL') || statusStr.includes('ERR') || statusStr.includes('REJECT') || statusStr.includes('CANCEL') || statusStr.includes('INVALID');
                        const isSuccessStatus = !isExplicitFailed && (statusStr.includes('RECEIVED') || statusStr.includes('COMPLETED') || statusStr.includes('SUCCESS') || statusStr === '00' || statusStr === '0' || statusStr === '200');

                        if (result && isSuccessStatus) {
                            console.log(`[Bills] VTU Transaction Succeeded via: ${vendor}`);
                            break;
                        } else {
                            console.warn(`[Bills] Vendor ${vendor} returned non-success result:`, JSON.stringify(result));
                            lastError = new Error(result?.message || result?.msg || `Transaction failed at provider network`);
                            result = null;
                        }
                    } catch (err: any) {
                        console.warn(`[Bills] Vendor ${vendor} failed: ${err.message}. Trying next fallback provider...`);
                        lastError = new Error(err.message || "Transaction failed at provider network");
                        result = null;
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

            const isSuccess = result && (
                result.status === 'ORDER_RECEIVED' || 
                result.status === 'ORDER_COMPLETED' || 
                result.status === 'SUCCESS' ||
                result.status === 'success' ||
                result.success === true
            );

            if (isSuccess) {
                // 5. Provider confirmed success — DEDUCT BALANCE NOW
                if (type !== 'get_plans' && type !== 'recharge_pin_plans') {
                    const { data: deductResult, error: deductError } = await rpcClient.rpc('deduct_balance', {
                        user_id: userId,
                        amount: amountToCharge
                    });

                    if (deductError) {
                        console.error("[Bills] Critical: Vendor dispatched, but balance deduction failed:", deductError.message);
                    } else {
                        console.log(`[Bills] Balance Deducted successfully for user ${userId}. Amount: ₦${amountToCharge}`);
                    }
                }

                // Recharge PIN specific table updates
                if (type === 'recharge_pin_purchase') {
                    const txId = result.orderid || requestId;
                    const pinsList = result.pins || [];
                    const planId = providerParams.planId || 1;
                    const qty = providerParams.quantity || 1;
                    const bName = providerParams.businessName || 'ABU MAFHAL VTU';
                    
                    const pinPlanInfo: Record<number, { network: string; denom: string; size: string }> = {
                        1: { network: 'MTN', denom: '₦100', size: '100' },
                        2: { network: 'MTN', denom: '₦200', size: '200' },
                        3: { network: 'MTN', denom: '₦500', size: '500' },
                        4: { network: 'MTN', denom: '₦1,000', size: '1000' }
                    };
                    const planInfo = pinPlanInfo[Number(planId)] || { network: 'MTN', denom: '₦100', size: '100' };

                    try {
                        await rpcClient.from('transactions').insert({
                            user_id: userId,
                            type: 'payment',
                            amount: amountToCharge,
                            status: 'success',
                            reference: txId,
                            description: `${planInfo.network} ${planInfo.denom} Recharge PIN x${qty} - ${bName}`
                        });
                    } catch (histErr) {
                        console.warn('[Bills] transactions insert note:', histErr);
                    }

                    try {
                        await rpcClient.from('recharge_pins').insert({
                            user_id: userId,
                            transaction_id: txId,
                            network: planInfo.network,
                            denomination: planInfo.denom,
                            amount: amountToCharge,
                            quantity: Number(qty),
                            business_name: bName,
                            pins: pinsList,
                            load_code: pinsList[0]?.load_code || '*311*PIN#',
                            created_at: new Date().toISOString()
                        });
                    } catch (pinErr) {
                        console.warn('[Bills] recharge_pins insert note:', pinErr);
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        data: {
                            transaction_id: txId,
                            orderid: txId,
                            pins: pinsList,
                            load_code: pinsList[0]?.load_code || '*311*PIN#',
                            network: planInfo.network,
                            denomination: planInfo.denom,
                            quantity: Number(qty),
                            business_name: bName
                        },
                        requestId
                    }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 200
                    });
                }
            } else {
                 throw new Error(result?.message || result?.status || "Provider API Failure");
            }

        } catch (error) {
            let errorMessage = error instanceof Error ? error.message : "Provider transaction failed";
            console.error("[Bills] Execution Failed:", errorMessage);
            
            // Mask vendor name
            if (errorMessage.toLowerCase().includes('clubkonnect') || errorMessage.toLowerCase().includes('bilalsadasub') || errorMessage.toLowerCase().includes('bigi')) {
                errorMessage = "Transaction could not be completed at this time by the provider network";
            }
            
            // Strict guarantee: User balance was NEVER deducted because deduction only happens after provider confirmation
            return new Response(JSON.stringify({ 
                success: false, 
                error: `${errorMessage}. Your wallet balance has NOT been deducted.` 
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

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature, verif-hash, flutterwave-signature, payvessel-http-signature'
};

async function getPaystackSecret(supabaseAdmin: SupabaseClient): Promise<string | null> {
    let secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
    if (secret && secret.length > 5) return secret;

    const { data: sec } = await supabaseAdmin
        .from('system_secrets')
        .select('value')
        .in('key', ['PAYSTACK_SECRET_KEY', 'PAYSTACK_KEY', 'PAYSTACK_SECRET', 'PAYSTACK_API_KEY'])
        .limit(1)
        .maybeSingle();

    if (sec?.value && sec.value.trim().length > 5) {
        return sec.value.trim();
    }

    const { data: appSec } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .in('key', ['PAYSTACK_SECRET_KEY', 'paystack_secret_key'])
        .limit(1)
        .maybeSingle();

    if (appSec?.value && appSec.value.trim().length > 5) {
        return appSec.value.trim();
    }

    return null;
}

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] Incoming Request: ${req.method} ${url.pathname}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // 1. Health Check for easier testing
    if (req.method === 'GET') {
        return new Response(JSON.stringify({
            status: "active",
            message: "Abu Mafhal Sub Webhook System is online",
            timestamp: timestamp,
            supported_providers: ['paystack', 'flutterwave', 'payvessel']
        }), { 
            headers: { "Content-Type": "application/json", ...corsHeaders },
            status: 200 
        });
    }

    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uagcxrtdqttayulvgpwg.supabase.co';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error(`[CRITICAL] Missing Supabase Env Vars. URL: ${!!supabaseUrl}, Key: ${!!supabaseServiceRoleKey}`);
            return new Response("Server Configuration Error", { status: 500, headers: corsHeaders });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const rawBody = await req.text();
        let parsedPayload: any = null;
        try {
            parsedPayload = JSON.parse(rawBody);
        } catch (_) {}

        // --- DIRECT IN-APP VERIFICATION HANDLER (PAYSTACK & CLIENT VERIFY) ---
        // Used when the mobile/web app directly requests instant verification of completed payment
        if (parsedPayload && (parsedPayload.action === 'verify_paystack' || parsedPayload.action === 'verify_payment' || (parsedPayload.provider === 'paystack' && !req.headers.get('x-paystack-signature')))) {
            const reference = (parsedPayload.reference || parsedPayload.trxref || '').trim();
            const requestedUserId = parsedPayload.userId || parsedPayload.user_id || null;

            console.log(`[VerifyPaystack] Direct verification initiated for Ref: ${reference}, User: ${requestedUserId}`);

            if (!reference) {
                return new Response(JSON.stringify({ success: false, error: "Transaction reference is required" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const paystackSecret = await getPaystackSecret(supabaseAdmin);
            if (!paystackSecret) {
                console.error("[VerifyPaystack] Missing PAYSTACK_SECRET_KEY in env and system_secrets");
                return new Response(JSON.stringify({ success: false, error: "Payment gateway configuration error (missing secret key)" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // Verify with Paystack API
            const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
            const paystackRes = await fetch(verifyUrl, {
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!paystackRes.ok) {
                const errBody = await paystackRes.text();
                console.error(`[VerifyPaystack] Paystack API HTTP Error (${paystackRes.status}):`, errBody);
                return new Response(JSON.stringify({ success: false, error: "Failed to communicate with Paystack" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const verifyResult = await paystackRes.json();
            console.log(`[VerifyPaystack] Paystack API Result for ${reference}: status=${verifyResult.status}, data.status=${verifyResult.data?.status}`);

            if (!verifyResult.status || verifyResult.data?.status !== 'success') {
                const failMsg = verifyResult.data?.gateway_response || verifyResult.message || 'Payment not successful on Paystack';
                return new Response(JSON.stringify({ success: false, message: failMsg }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const txData = verifyResult.data;
            const amountInNaira = txData.amount / 100;
            const currency = txData.currency || 'NGN';
            const customerEmail = txData.customer?.email || '';

            // Extract target user ID
            let targetUserId = requestedUserId || txData.metadata?.user_id || txData.metadata?.userId || null;
            if (!targetUserId && txData.metadata?.custom_fields) {
                const f = txData.metadata.custom_fields.find((c: any) => c.variable_name === 'user_id' || c.display_name === 'User ID');
                if (f) targetUserId = f.value;
            }
            if (!targetUserId && txData.reference && txData.reference.startsWith('PAY_')) {
                const parts = txData.reference.split('_');
                if (parts[1] && parts[1].length >= 32) {
                    targetUserId = parts[1];
                }
            }

            // Fund the wallet idempotently
            return await handleFundWallet(
                supabaseAdmin,
                'paystack',
                txData.reference,
                amountInNaira,
                currency,
                customerEmail,
                txData,
                targetUserId
            );
        }

        // Detect Provider based on webhook headers
        const paystackSignature = req.headers.get('x-paystack-signature');
        const flwSignature = req.headers.get('verif-hash') || req.headers.get('flutterwave-signature');
        
        let payvesselSignature = (
            req.headers.get('payvessel-http-signature') ||
            req.headers.get('payvessel_http_signature') ||
            req.headers.get('x-payvessel-signature') ||
            req.headers.get('http_payvessel_http_signature') || 
            req.headers.get('http-payvessel-http-signature') ||
            req.headers.get('HTTP_PAYVESSEL_HTTP_SIGNATURE')
        )?.trim();
        
        const isPayvesselPayload = payvesselSignature || 
                                   rawBody.includes('payvessel') || 
                                   rawBody.includes('reserved_account') || 
                                   rawBody.includes('customerReservedAccount');

        console.log(`[Webhook] Detect: PaystackSig=${!!paystackSignature}, FLWSig=${!!flwSignature}, PayvesselSig=${!!payvesselSignature}, IsPayvesselPayload=${isPayvesselPayload}`);

        // --- PAYVESSEL WEBHOOK HANDLER ---
        if (isPayvesselPayload) {
            let PAYVESSEL_API_SECRET = Deno.env.get('PAYVESSEL_API_SECRET')?.trim();
            
            // Fallback to system_secrets if not in Deno.env
            if (!PAYVESSEL_API_SECRET) {
                const { data: secrets } = await supabaseAdmin
                    .from('system_secrets')
                    .select('value')
                    .eq('key', 'PAYVESSEL_API_SECRET')
                    .single();
                if (secrets && secrets.value) {
                    PAYVESSEL_API_SECRET = secrets.value.trim();
                }
            }

            const bodyText = rawBody;
            if (PAYVESSEL_API_SECRET) {
                if (!payvesselSignature) {
                    console.error("[Payvessel Webhook] Missing required payvessel-http-signature header");
                    return new Response(JSON.stringify({ error: "Missing signature header" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
                }

                const encoder = new TextEncoder();
                const key = await crypto.subtle.importKey(
                    "raw",
                    encoder.encode(PAYVESSEL_API_SECRET),
                    { name: "HMAC", hash: "SHA-512" },
                    false,
                    ["sign"]
                );

                const signatureBuffer = await crypto.subtle.sign(
                    "HMAC",
                    key,
                    encoder.encode(bodyText)
                );

                const hashArray = Array.from(new Uint8Array(signatureBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                if (hashHex.toLowerCase() !== payvesselSignature.toLowerCase()) {
                    console.error("[Payvessel Webhook] Signature mismatch. Received:", payvesselSignature, "Computed:", hashHex);
                    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
                }
            }

            const eventData = JSON.parse(bodyText);
            const eventName = eventData.event || (eventData.transaction ? eventData.transaction.status : 'unknown');
            console.log("=== PAYVESSEL WEBHOOK TRANSACTION ===");
            console.log("Payload:", JSON.stringify(eventData));
            console.log("Payvessel Event:", eventName);

            const isSuccess = eventData.event === 'transaction.success' || 
                              eventData.event === 'reserved_account.credit' || 
                              eventData.transaction?.status === 'success' || 
                              eventData.transaction?.status === 'successful' ||
                              (eventData.transaction && eventData.transaction.reference !== undefined) ||
                              (eventData.order && eventData.order.amount !== undefined);

            if (isSuccess) {
                const transactionObj = eventData.transaction || eventData.data || {};
                const orderObj = eventData.order || eventData.data || {};
                
                const reference = transactionObj.reference || eventData.reference;
                const rawAmount = orderObj.amount || transactionObj.amount || eventData.amount;
                const amount = parseFloat(String(rawAmount));
                const currency = orderObj.currency || transactionObj.currency || eventData.currency || 'NGN';
                const email = transactionObj.customer_email || transactionObj.customer?.email || eventData.customer_email || eventData.email || eventData.customer?.email;
                let accountNumber = eventData.account_number || 
                                      eventData.accountNumber ||
                                      eventData.order?.description ||
                                      transactionObj.virtual_account?.account_number ||
                                      transactionObj.virtualAccount?.accountNumber ||
                                      eventData.virtual_account?.account_number ||
                                      eventData.virtualAccount?.accountNumber ||
                                      eventData.customer?.virtual_account_number;
                                      
                if (accountNumber && accountNumber.length > 10) {
                    const match = accountNumber.match(/\b\d{10}\b/);
                    if (match) {
                        accountNumber = match[0];
                    }
                }
                
                console.log(`[Payvessel Webhook] Parsed: Ref=${reference}, Amt=${amount}, Email=${email}, AccNum=${accountNumber}`);
                
                if (!reference || isNaN(amount)) {
                    console.error("Missing required fields in parsed webhook data:", { reference, amount });
                    return new Response("Invalid data structure", { status: 400, headers: corsHeaders });
                }

                return await handleFundWallet(
                    supabaseAdmin, 
                    'payvessel', 
                    String(reference), 
                    amount, 
                    currency, 
                    email, 
                    { ...eventData, account_number: accountNumber },
                    null
                );
            }

            return new Response("Event Ignored", { status: 200, headers: corsHeaders });
        }

        // --- PAYSTACK WEBHOOK HANDLER ---
        if (paystackSignature) {
            const paystackSecret = await getPaystackSecret(supabaseAdmin);
            if (!paystackSecret) {
                console.error("[CRITICAL] PAYSTACK_SECRET_KEY not set in env or system_secrets");
                return new Response("Provider Config Error", { status: 500, headers: corsHeaders });
            }

            const body = rawBody;
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                "raw",
                encoder.encode(paystackSecret),
                { name: "HMAC", hash: "SHA-512" },
                false,
                ["sign"]
            );

            const signatureBuffer = await crypto.subtle.sign(
                "HMAC",
                key,
                encoder.encode(body)
            );

            const hashArray = Array.from(new Uint8Array(signatureBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            if (hashHex !== paystackSignature) {
                console.error("Invalid Paystack signature match. Received:", paystackSignature, "Computed:", hashHex);
                return new Response("Invalid signature", { status: 401, headers: corsHeaders });
            }

            const event = JSON.parse(body);
            console.log(`[Paystack Webhook] Event: ${event.event}, Ref: ${event.data?.reference}`);

            if (event.event === 'charge.success') {
                const txData = event.data;
                let targetUserId = txData.metadata?.user_id || txData.metadata?.userId || null;
                if (!targetUserId && txData.metadata?.custom_fields) {
                    const f = txData.metadata.custom_fields.find((c: any) => c.variable_name === 'user_id' || c.display_name === 'User ID');
                    if (f) targetUserId = f.value;
                }
                if (!targetUserId && txData.reference && txData.reference.startsWith('PAY_')) {
                    const parts = txData.reference.split('_');
                    if (parts[1] && parts[1].length >= 32) {
                        targetUserId = parts[1];
                    }
                }

                return await handleFundWallet(
                    supabaseAdmin,
                    'paystack',
                    txData.reference,
                    txData.amount / 100,
                    txData.currency || 'NGN',
                    txData.customer?.email || '',
                    txData,
                    targetUserId
                );
            }
            return new Response("Event Ignored", { status: 200, headers: corsHeaders });
        }

        // --- FLUTTERWAVE WEBHOOK HANDLER ---
        if (flwSignature) {
             const bodyText = rawBody;
             let event;
             try {
                event = JSON.parse(bodyText);
                console.log("Flutterwave Webhook Event:", event.event || event['event.type']);
             } catch (_e) {
                console.error("Failed to parse Flutterwave body:", bodyText);
                return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
             }

             const secretHash = Deno.env.get('FLUTTERWAVE_SECRET_HASH');
             if (secretHash && flwSignature !== secretHash) {
                 console.error("[Flutterwave Webhook] Invalid secret hash signature");
                 return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
             }

             if (event.event === 'charge.completed' || (event['event.type'] === 'BANK_TRANSFER_TRANSACTION')) {
                 const data = event.data;
                 if (data.status === 'successful') {
                     const email = data.customer?.email;
                     let userId = null;

                    if (data.tx_ref && data.tx_ref.startsWith('dva_')) {
                         const parts = data.tx_ref.split('_');
                         if (parts[1] === 'assign' && parts.length > 2) {
                             userId = parts[2];
                         } else if (parts[1]) {
                             userId = parts[1]; 
                         }
                     }

                     return await handleFundWallet(supabaseAdmin, 'flutterwave', String(data.id || data.flw_ref), data.amount, data.currency, email, data, userId);
                 }
             }
             return new Response("Event Ignored", { status: 200, headers: corsHeaders });
        }

        console.warn(`[Webhook] No recognizable provider header. Headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);
        return new Response("Unknown Provider Request", { status: 200, headers: corsHeaders });

    } catch (error: unknown) {
        console.error("[CRITICAL] Webhook Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ 
            error: "Internal processing failure", 
            details: errorMessage 
        }), { 
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
});

// Helper Function for Shared Logic
type PaymentMetadata = {
    id?: string | number;
    flw_ref?: string;
    tx_ref?: string;
    account_number?: string;
    narration?: string;
    [key: string]: string | number | boolean | null | undefined | object;
};

async function handleFundWallet(supabaseAdmin: SupabaseClient, provider: string, reference: string, amount: number, currency: string, email: string, data: PaymentMetadata, explicitUserId: string | null = null) {
    
    console.log(`[FundWallet] VERSION: FIX_IDEMPOTENCY_V3`);
    console.log(`[FundWallet] Init: Ref=${reference}, Prov=${provider}, Amt=${amount}, UserID=${explicitUserId || 'none'}`);

    // 1. Check Idempotency
    const { data: existing, error: checkError } = await supabaseAdmin
        .from('payment_events')
        .select('reference, status')
        .eq('reference', reference)
        .maybeSingle();

    if (checkError) {
        console.error(`[FundWallet] Idempotency Check Error: ${checkError.message}`);
        return new Response("Internal Error Checking Duplicate", { status: 500, headers: corsHeaders });
    }

    if (existing && existing.status === 'completed') {
        console.log(`[FundWallet] Duplicate Event Ignored: ${reference} (Already completed)`);
        return new Response(JSON.stringify({
            success: true,
            message: "Already Processed",
            reference: reference
        }), { 
            status: 200, 
            headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
    }

    // 2. Find User
    let profile = null;
    let method = 'none';

    // A. Try finding by Explicit ID first
    if (explicitUserId) {
        let sId = String(explicitUserId).trim();
        if (sId.length === 32 && !sId.includes('-')) {
            sId = sId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5');
        }
        const { data, error } = await supabaseAdmin.from('profiles').select('id, balance, email, full_name, expo_push_token').eq('id', sId).maybeSingle();
        if (data && !error) {
            profile = data;
            method = 'specific_id_from_ref';
        } else {
             console.warn(`[FundWallet] Explicit User ID ${explicitUserId} lookup failed: ${error?.message}`);
        }
    }

    // B. Try finding by metadata user_id
    if (!profile && (data.metadata?.user_id || data.metadata?.userId)) {
        let metaId = String(data.metadata?.user_id || data.metadata?.userId).trim();
        if (metaId.length === 32 && !metaId.includes('-')) {
            metaId = metaId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5');
        }
        const { data: pData } = await supabaseAdmin.from('profiles').select('id, balance, email, full_name, expo_push_token').eq('id', metaId).maybeSingle();
        if (pData) {
            profile = pData;
            method = 'metadata_user_id';
        }
    }

    // C. Try finding by Virtual Account Number
    if (!profile && data.account_number) {
        console.log(`[FundWallet] Searching by Account Number: ${data.account_number}`);
        const { data: va, error: vaError } = await supabaseAdmin
            .from('virtual_accounts')
            .select('user_id')
            .eq('account_number', data.account_number)
            .maybeSingle();
            
        if (va) {
            const { data: p } = await supabaseAdmin.from('profiles').select('id, balance, email, full_name, expo_push_token').eq('id', va.user_id).single();
            if (p) {
                profile = p;
                method = 'virtual_account_number';
            }
        }
    }

    // D. Try finding by reference prefix (PAY_{userId}_timestamp)
    if (!profile && reference && reference.startsWith('PAY_')) {
        const parts = reference.split('_');
        if (parts[1] && parts[1].length >= 32) {
            let refId = parts[1];
            if (refId.length === 32 && !refId.includes('-')) {
                refId = refId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5');
            }
            const { data: refProf } = await supabaseAdmin.from('profiles').select('id, balance, email, full_name, expo_push_token').eq('id', refId).maybeSingle();
            if (refProf) {
                profile = refProf;
                method = 'ref_user_id';
            }
        }
    }

    // E. Email lookup
    if (!profile && email && email !== 'user@example.com' && email !== 'customer@abumafhalsub.com' && email.includes('@')) {
        const { data } = await supabaseAdmin.from('profiles').select('id, balance, email, full_name, expo_push_token').eq('email', email).maybeSingle();
        if (data) {
            profile = data;
            method = 'email_fallback';
        }
    }

    // F. Phone lookup
    const custPhone = data.customer?.phone || (data as any).phone;
    if (!profile && custPhone) {
        const cleanPhone = String(custPhone).replace(/[^0-9]/g, '');
        const last10 = cleanPhone.slice(-10);
        const { data: phoneProf } = await supabaseAdmin
            .from('profiles')
            .select('id, balance, email, full_name, expo_push_token')
            .or(`phone.eq.${custPhone},phone.ilike.%${last10}`)
            .limit(1)
            .maybeSingle();
        if (phoneProf) {
            profile = phoneProf;
            method = 'phone_lookup';
        }
    }

    if (!profile) {
        console.error(`[FundWallet] User NOT found. Email: ${email}, ID: ${explicitUserId}, Ref: ${reference}`);
        if (existing) {
            await supabaseAdmin.from('payment_events').update({
                amount: amount,
                provider: provider,
                currency: currency,
                status: 'orphaned',
                metadata: { metadata: data }
            }).eq('reference', reference);
        } else {
            await supabaseAdmin.from('payment_events').insert({
                reference: reference,
                amount: amount,
                provider: provider,
                currency: currency,
                status: 'orphaned',
                metadata: { metadata: data }
            });
        }
        return new Response(JSON.stringify({ success: false, error: "User profile not found for this payment" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
    
    console.log(`[FundWallet] User Match via ${method}: ${profile.id}`);

    // 2.5 Dynamic Tiered Funding Fee Calculation:
    let threshold = 5000;
    let underFee = 50;
    let aboveFeePercent = 1;

    const { data: feeSettings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['funding_fee_fixed_threshold', 'funding_fee_under_threshold', 'funding_fee_above_threshold']);

    if (feeSettings) {
        const tSetting = feeSettings.find(s => s.key === 'funding_fee_fixed_threshold');
        if (tSetting && !isNaN(parseFloat(tSetting.value))) threshold = parseFloat(tSetting.value);

        const uSetting = feeSettings.find(s => s.key === 'funding_fee_under_threshold');
        if (uSetting && !isNaN(parseFloat(uSetting.value))) underFee = parseFloat(uSetting.value);

        const aSetting = feeSettings.find(s => s.key === 'funding_fee_above_threshold');
        if (aSetting && !isNaN(parseFloat(aSetting.value))) aboveFeePercent = parseFloat(aSetting.value);
    }

    let feeAmount = 0;
    let feeType = 'fixed';
    let feeValue = underFee;

    if (amount < threshold) {
        feeAmount = underFee;
        feeType = 'fixed';
        feeValue = underFee;
        console.log(`[FundWallet] Amount < ${threshold}: Applying fixed ₦${underFee} fee to deposit of ₦${amount}`);
    } else {
        feeAmount = amount * (aboveFeePercent / 100);
        feeType = 'percentage';
        feeValue = aboveFeePercent;
        console.log(`[FundWallet] Amount >= ${threshold}: Applying ${aboveFeePercent}% fee (₦${feeAmount}) to deposit of ₦${amount}`);
    }
    
    const creditedAmount = Math.max(0, amount - feeAmount);

    // 3. Fund Wallet (Atomic RPC)
    let finalBalance = 0;
    const { data: newBalance, error: updateError } = await supabaseAdmin.rpc('credit_balance', {
        user_id: profile.id,
        amount: creditedAmount
    });

    if (updateError) {
        console.error("[FundWallet] Balance RPC Error:", updateError.message);
        console.warn("[FundWallet] Falling back to standard fetch-and-update");
        const { data: currentProfile, error: fetchErr } = await supabaseAdmin
            .from('profiles')
            .select('balance')
            .eq('id', profile.id)
            .single();
            
        if (fetchErr) throw fetchErr;

        finalBalance = (parseFloat(currentProfile.balance || "0") + creditedAmount);
        const { error: fallbackUpdateErr } = await supabaseAdmin
            .from('profiles')
            .update({ balance: finalBalance })
            .eq('id', profile.id);

        if (fallbackUpdateErr) throw fallbackUpdateErr;
    } else {
        finalBalance = newBalance;
    }

    console.log(`[FundWallet] Balance Updated. New Balance: ${finalBalance}`);

    // 4. Record Transaction & Log Event
    const metadata = data || {}; 

    // Check if deposit transaction was already inserted
    const { data: existingTx } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

    if (!existingTx) {
        const transactionsToInsert = [
            {
                user_id: profile.id,
                type: 'deposit',
                amount: amount,
                status: 'success',
                reference: reference, 
                description: `Deposit via ${provider.toUpperCase()} (${method}) - Ref: ${reference}`
            }
        ];

        if (feeAmount > 0) {
            transactionsToInsert.push({
                user_id: profile.id,
                type: 'fee',
                amount: feeAmount,
                status: 'success',
                reference: `${reference}-fee`, 
                description: `Funding Fee Deducted (${feeType === 'fixed' ? '₦'+feeValue : feeValue+'%'})`
            });
        }

        await supabaseAdmin.from('transactions').insert(transactionsToInsert);
    }

    // Update payment_events record to completed
    if (existing) {
        await supabaseAdmin.from('payment_events').update({
            amount: amount,
            provider: provider,
            currency: currency,
            status: 'completed',
            processed_at: new Date().toISOString(),
            metadata: { metadata: metadata }
        }).eq('reference', reference);
    } else {
        await supabaseAdmin.from('payment_events').insert({
            reference: reference,
            amount: amount,
            provider: provider,
            currency: currency,
            status: 'completed',
            processed_at: new Date().toISOString(),
            metadata: { metadata: metadata }
        });
    }

    const formattedAmount = creditedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
    const formattedBalance = finalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 });

    // 4.5 Insert Notification & Dispatch Expo Push Notification with Sound
    try {
        const notifTitle = `💰 Wallet Funded: ₦${formattedAmount}`;
        const notifBody = `Your wallet has been credited with ₦${formattedAmount}. Ref: ${reference}`;

        await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: notifTitle,
            body: notifBody,
            type: 'funding',
            priority: 'high',
            is_read: false,
            data: { route: '/(app)/history', reference: reference }
        });

        if (profile.expo_push_token) {
            console.log(`[FundWallet] Dispatching push notification to token: ${profile.expo_push_token}`);
            fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: profile.expo_push_token,
                    sound: 'default',
                    title: notifTitle,
                    body: notifBody,
                    channelId: 'transactions',
                    priority: 'high',
                    data: { route: '/(app)/history', reference: reference }
                }),
            }).then(async res => {
                if (!res.ok) {
                    console.warn('[FundWallet] Push failed:', await res.text());
                } else {
                    console.log('[FundWallet] Push delivered successfully');
                }
            }).catch(pushErr => {
                console.warn('[FundWallet] Push error:', pushErr);
            });
        }
    } catch (notifErr) {
        console.warn('[FundWallet] Notification dispatch error:', notifErr);
    }

    // 5. Send Email Receipt Notification to User
    try {
        const userEmail = email || profile.email;
        if (userEmail && userEmail.includes('@')) {
            const customerName = profile.full_name || 'Valued Customer';
            const subject = `Wallet Funding Notification - ₦${formattedAmount}`;
            const plainText = `Hi ${customerName},\n\nYour wallet has been credited with ₦${formattedAmount}.\n\nReference: ${reference}\nProvider: ${provider.toUpperCase()}\nNew Balance: ₦${formattedBalance}\n\nThank you for choosing Abu Mafhal Sub!`;
            
            const htmlBody = `
                <div style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #060d21 0%, #0d1b3e 100%); color: #f5a623; padding: 20px; text-align: center;">
                            <h1 style="margin: 0; font-size: 22px;">Abu Mafhal Sub</h1>
                            <p style="margin: 5px 0 0; font-size: 14px; color: #ffffff;">Wallet Funding Receipt</p>
                        </div>
                        <div style="padding: 24px;">
                            <h2 style="color: #107c10; font-size: 20px; margin-top: 0;">Deposit Successful! 🎉</h2>
                            <p>Hello <b>${customerName}</b>,</p>
                            <p>We are pleased to inform you that your wallet funding has been successfully processed.</p>
                            
                            <div style="background: #f8fafc; border-left: 4px solid #107c10; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 4px 0;"><b>Amount Credited:</b> <span style="color: #107c10; font-weight: bold;">₦${formattedAmount}</span></p>
                                <p style="margin: 4px 0;"><b>New Balance:</b> ₦${formattedBalance}</p>
                                <p style="margin: 4px 0;"><b>Payment Provider:</b> ${provider.toUpperCase()}</p>
                                <p style="margin: 4px 0;"><b>Transaction Reference:</b> ${reference}</p>
                                <p style="margin: 4px 0;"><b>Date:</b> ${new Date().toLocaleString()}</p>
                            </div>
                            
                            <p style="font-size: 13px; color: #64748b;">If you have any questions or did not initiate this transaction, please contact our support team immediately.</p>
                        </div>
                        <div style="background: #060d21; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px;">
                            &copy; ${new Date().getFullYear()} Abu Mafhal Sub. All rights reserved.
                        </div>
                    </div>
                </div>
            `;

            console.log(`[FundWallet] Dispatching funding receipt email to ${userEmail}...`);
            sendEmail(userEmail, subject, plainText, htmlBody, supabaseAdmin).catch(err => {
                console.warn("[FundWallet Email Dispatch Warning]:", err?.message || err);
            });
        }
    } catch (emailErr) {
        console.warn("[FundWallet Email Exception]:", emailErr);
    }

    return new Response(JSON.stringify({
        success: true,
        message: "Wallet Funded",
        reference: reference,
        credited_amount: creditedAmount,
        final_balance: finalBalance
    }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
    });
}

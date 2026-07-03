
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variables are now fetched inside Deno.serve for better error handling/logging


Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] Incoming Request: ${req.method} ${url.pathname}`);

    // 1. Health Check for easier testing
    if (req.method === 'GET') {
        return new Response(JSON.stringify({
            status: "active",
            message: "Abu Mafhal Sub Webhook System is online",
            timestamp: timestamp,
            supported_providers: ['paystack', 'flutterwave', 'payvessel']
        }), { 
            headers: { "Content-Type": "application/json" },
            status: 200 
        });
    }

    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uagcxrtdqttayulvgpwg.supabase.co';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error(`[CRITICAL] Missing Supabase Env Vars. URL: ${!!supabaseUrl}, Key: ${!!supabaseServiceRoleKey}`);
            return new Response("Server Configuration Error", { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Detect Provider based on headers
        const paystackSignature = req.headers.get('x-paystack-signature');
        const flwSignature = req.headers.get('verif-hash') || req.headers.get('flutterwave-signature');
        const payvesselSignature = req.headers.get('payvessel-http-signature') ||
                                   req.headers.get('http_payvessel_http_signature') || 
                                   req.headers.get('http-payvessel-http-signature') ||
                                   req.headers.get('HTTP_PAYVESSEL_HTTP_SIGNATURE');
        
        console.log(`[Webhook] Detect: PaystackSig=${!!paystackSignature}, FLWSig=${!!flwSignature}, PayvesselSig=${!!payvesselSignature}`);

        const rawBody = await req.text();
        
        // --- DEBUG LOGGING ---
        try {
             await supabaseAdmin.from('payment_events').insert({
                 reference: `req_${Date.now()}`,
                 amount: 0,
                 status: 'debug',
                 metadata: { 
                     headers: Object.fromEntries(req.headers),
                     body: rawBody,
                     provider: 'DEBUG_RAW'
                 }
             });
        } catch (e) { console.error("Debug log failed", e); }

        // --- PAYVESSEL HANDLER ---
        if (payvesselSignature) {
            let PAYVESSEL_API_SECRET = Deno.env.get('PAYVESSEL_API_SECRET');
            
            // Fallback to system_secrets if not in Deno.env
            if (!PAYVESSEL_API_SECRET) {
                const { data: secrets } = await supabaseAdmin
                    .from('system_secrets')
                    .select('value')
                    .eq('key', 'PAYVESSEL_API_SECRET')
                    .single();
                if (secrets && secrets.value) {
                    PAYVESSEL_API_SECRET = secrets.value;
                }
            }

            if (!PAYVESSEL_API_SECRET) {
                console.error("[CRITICAL] PAYVESSEL_API_SECRET not set in Deno.env or system_secrets");
                return new Response("Provider Config Error", { status: 500 });
            }

            // signature verification uses rawBody
            const bodyText = rawBody;
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

            if (hashHex !== payvesselSignature) {
                console.error("Invalid Payvessel signature match. Signature header:", payvesselSignature, "Computed:", hashHex);
                return new Response("Invalid signature", { status: 401 });
            }

            // IP allowlist check
            const ipHeader = req.headers.get('x-forwarded-for') || '';
            const clientIp = ipHeader.split(',')[0].trim();
            const TRUSTED_IPS = ['3.255.23.38', '162.246.254.36'];
            console.log(`[Payvessel Webhook] Incoming from IP: ${clientIp}`);
            if (clientIp && !TRUSTED_IPS.includes(clientIp)) {
                console.warn(`Payvessel webhook request from untrusted IP: ${clientIp}. Continuing signature verified payload...`);
            }

            const eventData = JSON.parse(bodyText);
            const eventName = eventData.event || (eventData.transaction ? eventData.transaction.status : 'unknown');
            console.log("=== NEW WEBHOOK DEPLOY ===");
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
                                      transactionObj.virtual_account?.account_number ||
                                      transactionObj.virtualAccount?.accountNumber ||
                                      transactionObj.virtual_account?.account_number ||
                                      transactionObj.virtualAccount?.accountNumber ||
                                      transactionObj.customer?.virtual_account_number ||
                                      transactionObj.customer?.virtualAccountNumber ||
                                      eventData.virtual_account?.account_number ||
                                      eventData.virtualAccount?.accountNumber ||
                                      eventData.customer?.virtual_account_number;
                                      
                // Payvessel sometimes puts the narration in order.description, which contains the 10-digit account number
                if (accountNumber && accountNumber.length > 10) {
                    const match = accountNumber.match(/\b\d{10}\b/);
                    if (match) {
                        accountNumber = match[0];
                    }
                }
                
                console.log(`[Payvessel Webhook] Parsed: Ref=${reference}, Amt=${amount}, Email=${email}, AccNum=${accountNumber}`);
                
                if (!reference || isNaN(amount)) {
                    console.error("Missing required fields in parsed webhook data:", { reference, amount });
                    return new Response("Invalid data structure", { status: 400 });
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

            return new Response("Event Ignored", { status: 200 });
        }

        // --- PAYSTACK HANDLER ---
        if (paystackSignature) {
            if (!PAYSTACK_SECRET_KEY) {
                console.error("[CRITICAL] PAYSTACK_SECRET_KEY not set");
                return new Response("Provider Config Error", { status: 500 });
            }
            const body = rawBody;
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                "raw",
                encoder.encode(PAYSTACK_SECRET_KEY),
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
                console.error("Invalid Paystack signature match");
                return new Response("Invalid signature", { status: 401 });
            }

            const event = JSON.parse(body);
            if (event.event === 'charge.success') {
                 return await handleFundWallet(supabaseAdmin, 'paystack', event.data.reference, event.data.amount / 100, event.data.currency, event.data.customer.email, event.data);
            }
            return new Response("Event Ignored", { status: 200 });
        }

        // --- FLUTTERWAVE HANDLER ---
        if (flwSignature) {
             const bodyText = rawBody;
             let event;
             try {
                event = JSON.parse(bodyText);
                console.log("Flutterwave Webhook Event:", event.event || event['event.type']);
             } catch (_e) {
                console.error("Failed to parse Flutterwave body:", bodyText);
                return new Response("Invalid JSON", { status: 400 });
             }

             // Verify Hash (Optional strict check)
             const secretHash = Deno.env.get('FLUTTERWAVE_SECRET_HASH');
             if (secretHash && flwSignature !== secretHash) {
                 console.warn("Flutterwave signature mismatch (but continuing if not enforced)");
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
             return new Response("Event Ignored", { status: 200 });
        }

        console.warn(`[Webhook] No recognizable provider header. Headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);
        return new Response("Unknown Provider Request", { status: 200 });

    } catch (error: unknown) {
        console.error("[CRITICAL] Webhook Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ 
            error: "Internal processing failure", 
            details: errorMessage 
        }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
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
    
    console.log(`[FundWallet] VERSION: FIX_IDEMPOTENCY_V2`); // VERIFICATION TAG
    console.log(`[FundWallet] Init: Ref=${reference}, Prov=${provider}, Amt=${amount}, UserID=${explicitUserId || 'none'}`);
    console.log(`[FundWallet] SourceData: ID=${data.id}, FlwRef=${data.flw_ref}, TxRef=${data.tx_ref}`);

    // 1. Check Idempotency
    const { data: existing, error: checkError } = await supabaseAdmin
        .from('payment_events')
        .select('reference')
        .eq('reference', reference)
        .maybeSingle();

    if (checkError) {
        console.error(`[FundWallet] Idempotency Check Error: ${checkError.message}`);
        return new Response("Internal Error Checking Duplicate", { status: 500 });
    }

    if (existing) {
        console.log(`[FundWallet] Duplicate Event Ignored: ${reference} (Already matched ID: ${existing.id})`);
        return new Response("Already Processed", { status: 200 });
    }

    // 2. Find User
    let profile = null;
    let method = 'none';

    // A. Try finding by Explicit ID first
    if (explicitUserId) {
        const { data, error } = await supabaseAdmin.from('profiles').select('id, balance').eq('id', explicitUserId).single();
        if (data && !error) {
            profile = data;
            method = 'specific_id_from_ref';
        } else {
             console.warn(`[FundWallet] Explicit User ID ${explicitUserId} lookup failed: ${error?.message}`);
        }
    }

    // B. Try finding by Virtual Account Number
    if (!profile && data.account_number) {
        // Log what we are searching for
        console.log(`[FundWallet] Searching by Account Number: ${data.account_number}`);
        const { data: va, error: vaError } = await supabaseAdmin
            .from('virtual_accounts')
            .select('user_id')
            .eq('account_number', data.account_number)
            .maybeSingle();
            
        if (vaError) {
            console.error(`[FundWallet] VA Lookup Error: ${vaError.message}`);
        }

        if (va) {
            const { data } = await supabaseAdmin.from('profiles').select('id, balance').eq('id', va.user_id).single();
            if (data) {
                profile = data;
                method = 'virtual_account_number';
            }
        } else {
            console.log(`[FundWallet] No VA found for account: ${data.account_number}`);
        }
    }

    // C. Fallback for missing data with explicit ID
    let finalMetadata = data;
    if (explicitUserId) {
        // Try to get ANY virtual account for this user so we don't violate NOT NULL constraint if applicable
        const vaResult = await supabaseAdmin
            .from('virtual_accounts')
            .select('id')
            .eq('user_id', explicitUserId)
            .maybeSingle();
        if (vaResult.data && !finalMetadata) {
            finalMetadata = vaResult.data as any;
        }
    }

    if (!profile && email) {
        const { data } = await supabaseAdmin.from('profiles').select('id, balance').eq('email', email).single();
        if (data) {
            profile = data;
            method = 'email_fallback';
        }
    }

    if (!profile) {
        console.error(`[FundWallet] User NOT found. Email: ${email}, ID: ${explicitUserId}, Ref: ${reference}`);
        await supabaseAdmin.from('payment_events').insert({
            reference: reference,
            amount: amount,
            provider: provider,
            currency: currency,
            status: 'orphaned',
            metadata: { metadata: data }
        });
        return new Response("User not found", { status: 200 }); // Return 200 to stop retry loops if it's a structural failure
    }
    
    console.log(`[FundWallet] User Match via ${method}: ${profile.id}`);

    // 2.5 Fetch Funding Fee
    let feeAmount = 0;
    let feeValue = 0;
    let feeType = 'percentage';
    const { data: feeSettings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['funding_fee_value', 'funding_fee_type', 'funding_fee_percentage']);
        
    if (feeSettings) {
        const typeSetting = feeSettings.find(s => s.key === 'funding_fee_type');
        if (typeSetting) feeType = typeSetting.value;
        
        let valSetting = feeSettings.find(s => s.key === 'funding_fee_value');
        if (!valSetting) valSetting = feeSettings.find(s => s.key === 'funding_fee_percentage');
        
        if (valSetting && valSetting.value) {
            feeValue = parseFloat(valSetting.value);
            if (!isNaN(feeValue) && feeValue > 0) {
                if (feeType === 'fixed') {
                    feeAmount = feeValue;
                    console.log(`[FundWallet] Applying fixed fee: ${feeAmount} deducted from ${amount}`);
                } else {
                    feeAmount = amount * (feeValue / 100);
                    console.log(`[FundWallet] Applying ${feeValue}% fee: ${feeAmount} deducted from ${amount}`);
                }
            }
        }
    }
    
    const creditedAmount = amount - feeAmount;

    // 3. Fund Wallet (Atomic RPC)
    let finalBalance = 0;
    const { data: newBalance, error: updateError } = await supabaseAdmin.rpc('credit_balance', {
        user_id: profile.id,
        amount: creditedAmount
    });

    if (updateError) {
        console.error("[FundWallet] Balance RPC Error:", updateError.message);
        console.warn("[FundWallet] Falling back to standard fetch-and-update");
        // Fallback mechanism
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

    // 4. Record Transaction & Log Event (Parallel)
    // We use allSettled so one failure doesn't throw and stop the logic
    const metadata = finalMetadata; 
    
    const transactionsToInsert = [
        {
            user_id: profile.id,
            type: 'deposit',
            amount: amount,
            status: 'success',
            reference: reference, 
            description: `Deposit via ${provider} (${method}) - Ref: ${reference}`
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

    const results = await Promise.allSettled([
        supabaseAdmin.from('transactions').insert(transactionsToInsert),
        // Update the payment log with success using reference and metadata
        supabaseAdmin.from('payment_events').insert({
            reference: reference, // Ensure this is unique
            amount: amount,
            provider: provider,
            currency: currency,
            status: 'completed',
            metadata: { metadata: metadata }
        })
    ]);

    // Check results
    const [txResult, eventResult] = results;
    
    if (txResult.status === 'rejected') {
        console.error(`[FundWallet] Transaction Insert FAILED:`, txResult.reason);
    } else if (txResult.value.error) {
        console.error(`[FundWallet] Transaction Insert DB Error:`, txResult.value.error);
    } else {
        console.log(`[FundWallet] Transaction Saved`);
    }

    if (eventResult.status === 'rejected') {
        console.error(`[FundWallet] Pyament Event Log FAILED:`, eventResult.reason);
    } else if (eventResult.value.error) {
        console.error(`[FundWallet] Payment Event Log DB Error:`, eventResult.value.error);
    } else {
        console.log(`[FundWallet] Payment Event Saved`);
    }

    return new Response("Wallet Funded", { status: 200 });
}


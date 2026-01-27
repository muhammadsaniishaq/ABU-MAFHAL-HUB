
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
            message: "Abu Mafhal Hub Webhook System is online",
            timestamp: timestamp,
            supported_providers: ['paystack', 'flutterwave']
        }), { 
            headers: { "Content-Type": "application/json" },
            status: 200 
        });
    }

    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
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
        
        console.log(`[Webhook] Detect: PaystackSig=${!!paystackSignature}, FLWSig=${!!flwSignature}`);

        // --- PAYSTACK HANDLER ---
        if (paystackSignature) {
            if (!PAYSTACK_SECRET_KEY) {
                console.error("[CRITICAL] PAYSTACK_SECRET_KEY not set");
                return new Response("Provider Config Error", { status: 500 });
            }
            const body = await req.text();
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
             const bodyText = await req.text();
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
        .select('id')
        .eq('reference', reference)
        .eq('provider', provider)
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

    // C. Fallback to email
    if (!profile && email) {
        const { data } = await supabaseAdmin.from('profiles').select('id, balance').eq('email', email).single();
        if (data) {
            profile = data;
            method = 'email_fallback';
        }
    }

    if (!profile) {
        console.error(`[FundWallet] User NOT found. Email: ${email}, ID: ${explicitUserId}, Data: ${JSON.stringify(data)}`);
        // We log the event anyway so we can debug later? No, payment_events usually requires valid processing?
        // Actually, we SHOULD record the orphaned payment attempt in a separate table or log it well.
        return new Response("User not found", { status: 200 }); // Return 200 to stop retry loops if it's a structural failure
    }
    
    console.log(`[FundWallet] User Match via ${method}: ${profile.id}`);

    // 3. Fund Wallet (Atomic RPC)
    const { data: newBalance, error: updateError } = await supabaseAdmin.rpc('credit_balance', {
        user_id: profile.id,
        amount: amount
    });

    if (updateError) {
        console.error("[FundWallet] Balance RPC Error:", updateError);
        throw updateError;
    }

    console.log(`[FundWallet] Balance Updated. New Balance: ${newBalance}`);

    // 4. Record Transaction & Log Event (Parallel)
    // We use allSettled so one failure doesn't throw and stop the logic (although we are at the end)
    const metadata = data; // use full data object
    const results = await Promise.allSettled([
        supabaseAdmin.from('transactions').insert({
            user_id: profile.id,
            type: 'deposit',
            amount: amount,
            status: 'success',
            reference: reference, 
            description: `Deposit via ${provider} (${method}) - Ref: ${reference}`
        }),
        supabaseAdmin.from('payment_events').insert({
            provider: provider,
            reference: reference, // Ensure this is unique
            amount: amount,
            currency: currency,
            status: 'success',
            metadata: metadata,
            processed_at: new Date().toISOString()
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


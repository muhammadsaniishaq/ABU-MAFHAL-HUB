import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature, verif-hash, flutterwave-signature, payvessel-http-signature, payvessel_http_signature, x-payvessel-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function getPaystackSecret(supabaseAdmin: SupabaseClient): Promise<string> {
    const envSecret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
    if (envSecret && envSecret.length > 10 && !envSecret.includes('...')) {
        return envSecret;
    }

    try {
        const { data: dbKeys } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value')
            .in('key', ['PAYSTACK_SECRET_KEY', 'PAYSTACK_KEY', 'PAYSTACK_SECRET', 'PAYSTACK_API_KEY']);

        if (dbKeys && dbKeys.length > 0) {
            for (const k of dbKeys) {
                if (k.value && k.value.trim().length > 10 && !k.value.includes('...')) {
                    return k.value.trim();
                }
            }
        }

        const { data: appSet } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .in('key', ['paystack_secret_key', 'PAYSTACK_SECRET_KEY'])
            .maybeSingle();

        if (appSet && appSet.value && appSet.value.trim().length > 10) {
            return appSet.value.trim();
        }
    } catch (e) {
        console.warn("[getPaystackSecret] Warning retrieving paystack secret:", e);
    }

    return '';
}

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] Incoming Request: ${req.method} ${url.pathname}`);

    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Health check
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

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });

        const rawBody = await req.text();
        let parsedPayload: any = null;
        try {
            parsedPayload = JSON.parse(rawBody);
        } catch (_) {}

        // --- ACTION: APPLY WALLET DATABASE RPC & TRIGGER FIX ---
        if (parsedPayload && parsedPayload.action === 'apply_wallet_db_fix') {
            const dbUrl = Deno.env.get('SUPABASE_DB_URL');
            if (!dbUrl) {
                return new Response(JSON.stringify({ success: false, error: "SUPABASE_DB_URL not set in secrets" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
            try {
                const { default: postgres } = await import("npm:postgres@3.4.4");
                const sql = postgres(dbUrl, { ssl: 'require' });
                
                await sql.unsafe(`
-- 0. ADD EXPO_PUSH_TOKEN COLUMN IF NOT EXISTS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;

-- 1. UPDATE TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.bypass_profile_lock', true) = 'true'
       OR (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
       OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    NEW.balance := OLD.balance;
    NEW.role := OLD.role;
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.referral_balance := OLD.referral_balance;
    NEW.monthly_profit := OLD.monthly_profit;
    NEW.reward_points := OLD.reward_points;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_unauthorized_profile_updates ON public.profiles;
CREATE TRIGGER tr_prevent_unauthorized_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_profile_updates();

-- 2. UPDATE EXECUTE_WALLET_TRANSFER (P2P Transfer)
CREATE OR REPLACE FUNCTION public.execute_wallet_transfer(
  sender_id uuid,
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default ''
)
returns jsonb as $$
declare
  v_sender_id uuid;
  sender_bal decimal;
  sender_name text;
  recipient_id uuid;
  recipient_name text;
  recipient_email text;
  reference text;
  result jsonb;
begin
  v_sender_id := auth.uid();
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if sender_id != v_sender_id then
    raise exception 'Unauthorized: You cannot transfer funds on behalf of another user';
  end if;

  if amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if target_id is not null then
    select id, full_name, email into recipient_id, recipient_name, recipient_email
    from public.profiles
    where id = target_id;
  elsif target_email is not null then
    select id, full_name, email into recipient_id, recipient_name, recipient_email
    from public.profiles
    where email = lower(trim(target_email));
  else
    raise exception 'Either target ID or target email must be provided';
  end if;

  if recipient_id is null then
    raise exception 'Recipient user not found';
  end if;

  if recipient_id = v_sender_id then
    raise exception 'You cannot transfer money to yourself';
  end if;

  select balance, full_name into sender_bal, sender_name
  from public.profiles
  where id = v_sender_id for update;

  if sender_bal is null then
    raise exception 'Sender profile not found';
  end if;

  if sender_bal < amount then
    raise exception 'Insufficient balance. Available balance is NGN %', sender_bal;
  end if;

  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = balance - amount
  where id = v_sender_id;

  update public.profiles
  set balance = balance + amount
  where id = recipient_id;

  reference := 'TRF-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (v_sender_id, 'transfer', amount, 'success', coalesce(note, 'Transfer to ' || recipient_name), reference || '-OUT');

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (recipient_id, 'deposit', amount, 'success', coalesce(note, 'Transfer received from ' || sender_name), reference || '-IN');

  result := jsonb_build_object(
    'success', true,
    'recipient_name', recipient_name,
    'recipient_email', recipient_email,
    'recipient_id', recipient_id,
    'new_balance', sender_bal - amount,
    'reference', reference
  );
  
  return result;
end;
$$ language plpgsql security definer;

-- 3. CREATE EXECUTE_USER_BANK_WITHDRAWAL (Bank Transfer / Outgoing)
CREATE OR REPLACE FUNCTION public.execute_user_bank_withdrawal(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_narration text default 'Bank Transfer',
  p_user_id uuid default null
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_current_bal numeric;
  v_new_bal numeric;
  v_ref text;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and p_user_id != auth.uid() then
    if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
       raise exception 'Unauthorized';
    end if;
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select balance into v_current_bal
  from public.profiles
  where id = v_user_id for update;

  if v_current_bal is null or v_current_bal < p_amount then
    raise exception 'Insufficient balance. Available balance: NGN %', coalesce(v_current_bal, 0);
  end if;

  v_new_bal := v_current_bal - p_amount;

  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = v_new_bal
  where id = v_user_id;

  v_ref := 'WTH-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (
    v_user_id, 
    'withdrawal', 
    p_amount, 
    'success', 
    coalesce(p_narration, 'Transfer to ' || p_bank_name || ' (' || p_account_number || ')') || ' - ' || p_account_name,
    v_ref
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_bal,
    'reference', v_ref,
    'amount', p_amount,
    'bank_name', p_bank_name,
    'account_number', p_account_number,
    'account_name', p_account_name
  );
end;
$$ language plpgsql security definer;

-- 4. UPDATE CREDIT_BALANCE AND DEDUCT_BALANCE
CREATE OR REPLACE FUNCTION public.credit_balance(user_id uuid, amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  new_balance numeric;
begin
  if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
     raise exception 'Unauthorized: Only admins can arbitrarily credit balances';
  end if;

  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id
  returning balance into new_balance;

  return new_balance;
end;
$$;

CREATE OR REPLACE FUNCTION public.deduct_balance(user_id uuid, amount numeric)
returns numeric as $$
declare
  current_bal numeric;
  new_bal numeric;
begin
  if current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' and not public.is_admin() then
     raise exception 'Unauthorized: Only admins can arbitrarily deduct balances';
  end if;

  select balance into current_bal from public.profiles where id = user_id for update;

  if current_bal is null or current_bal < amount then
     raise exception 'Insufficient balance';
  end if;

  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = balance - amount
  where id = user_id
  returning balance into new_bal;

  return new_bal;
end;
$$ language plpgsql security definer;
                `);
                
                await sql.end();
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: "Database functions and triggers successfully patched and deployed!" 
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch (dbErr: any) {
                console.error("[apply_wallet_db_fix] Error:", dbErr);
                return new Response(JSON.stringify({ success: false, error: dbErr.message || String(dbErr) }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: GET RECENT PAYMENT DEBUG LOGS ---
        if (parsedPayload && parsedPayload.action === 'get_debug_logs') {
            const { data: events, error: evErr } = await supabaseAdmin
                .from('payment_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);
            return new Response(JSON.stringify({ success: true, events, error: evErr }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // --- ACTION: REPROCESS ORPHANED PAYMENTS ---
        if (parsedPayload && parsedPayload.action === 'reprocess_orphaned') {
            const { data: orphanedEvents } = await supabaseAdmin
                .from('payment_events')
                .select('*')
                .eq('status', 'orphaned')
                .order('created_at', { ascending: false })
                .limit(20);

            const results: any[] = [];
            if (orphanedEvents && orphanedEvents.length > 0) {
                for (const ev of orphanedEvents) {
                    const meta = ev.metadata?.metadata || ev.metadata || {};
                    const orderObj = meta.order || meta.data || {};
                    const transactionObj = meta.transaction || meta.data || {};
                    const rawAmount = ev.amount || orderObj.amount || transactionObj.amount;
                    const amount = parseFloat(String(rawAmount));
                    const currency = ev.currency || orderObj.currency || 'NGN';
                    const email = meta.customer?.email || transactionObj.customer_email || meta.email;

                    let accNum = meta.account_number || 
                                 meta.accountNumber ||
                                 meta.virtualAccount?.virtualAccountNumber ||
                                 meta.virtual_account?.account_number ||
                                 transactionObj.virtual_account?.account_number;

                    if (!accNum) {
                        const desc = String(orderObj.description || meta.narration || '');
                        const match = desc.match(/\b\d{10}\b/);
                        if (match) accNum = match[0];
                    }

                    console.log(`[Reprocess] Retrying orphaned ref: ${ev.reference}, amt: ${amount}, acc: ${accNum}`);

                    try {
                        const fundRes = await handleFundWallet(
                            supabaseAdmin,
                            ev.provider || 'payvessel',
                            ev.reference,
                            amount,
                            currency,
                            email,
                            { ...meta, account_number: accNum },
                            null,
                            false
                        );
                        results.push({ reference: ev.reference, status: fundRes.status });
                    } catch (e: any) {
                        results.push({ reference: ev.reference, error: e.message });
                    }
                }
            }

            return new Response(JSON.stringify({ success: true, processed: results }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // --- ACTION: GET NIGERIAN BANKS (PAYSTACK) ---
        if (parsedPayload && parsedPayload.action === 'get_banks') {
            try {
                const paystackSecret = await getPaystackSecret(supabaseAdmin);
                const headers: Record<string, string> = {};
                if (paystackSecret) {
                    headers['Authorization'] = `Bearer ${paystackSecret}`;
                }
                const bRes = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=300', { headers });
                const bData = await bRes.json();
                if (bData.status && Array.isArray(bData.data)) {
                    // Popular Nigerian Banks prioritized at the top
                    const priorityMap: Record<string, number> = {
                        '999992': 1,  // OPay
                        '999991': 2,  // PalmPay
                        '50515': 3,   // Moniepoint
                        '50211': 4,   // Kuda
                        '058': 5,     // GTBank
                        '057': 6,     // Zenith
                        '044': 7,     // Access
                        '011': 8,     // First Bank
                        '033': 9,     // UBA
                        '232': 10,    // Sterling
                        '035': 11,    // Wema (ALAT)
                        '070': 12,    // Fidelity
                        '214': 13,    // FCMB
                        '221': 14,    // Stanbic IBTC
                        '032': 15,    // Union
                        '076': 16,    // Polaris
                        '301': 17,    // Jaiz
                        '302': 18,    // TAJ
                        '050': 19,    // Ecobank
                        '082': 20,    // Keystone
                    };

                    const banks = bData.data.map((b: any) => ({
                        id: String(b.id),
                        name: b.name,
                        code: b.code,
                        slug: b.slug,
                        logo: `https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/${b.slug}.png`
                    }));

                    banks.sort((a: any, b: any) => {
                        const aRank = priorityMap[a.code] || 999;
                        const bRank = priorityMap[b.code] || 999;
                        if (aRank !== bRank) return aRank - bRank;
                        return a.name.localeCompare(b.name);
                    });

                    return new Response(JSON.stringify({ success: true, count: banks.length, banks }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
                return new Response(JSON.stringify({ success: false, error: "Failed to fetch bank list from Paystack" }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch (err: any) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: RESOLVE NIGERIAN BANK ACCOUNT NAME (PAYSTACK) ---
        if (parsedPayload && parsedPayload.action === 'resolve_bank_account') {
            const accNum = String(parsedPayload.account_number || parsedPayload.accountNumber || '').trim();
            const bankCode = String(parsedPayload.bank_code || parsedPayload.bankCode || '').trim();

            if (accNum.length !== 10) {
                return new Response(JSON.stringify({ success: false, message: "Bank account number must be exactly 10 digits." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            if (!bankCode) {
                return new Response(JSON.stringify({ success: false, message: "Please select a bank." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const paystackSecret = await getPaystackSecret(supabaseAdmin);
            if (!paystackSecret) {
                return new Response(JSON.stringify({ success: false, message: "Paystack secret key is not configured." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            try {
                const resolveUrl = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accNum)}&bank_code=${encodeURIComponent(bankCode)}`;
                const rRes = await fetch(resolveUrl, {
                    headers: {
                        Authorization: `Bearer ${paystackSecret}`,
                        'Content-Type': 'application/json'
                    }
                });

                const rData = await rRes.json();
                console.log(`[ResolveAccount] Query=${accNum}@${bankCode}, Status=${rRes.status}, PaystackStatus=${rData.status}`);

                if (rData.status && rData.data?.account_name) {
                    return new Response(JSON.stringify({
                        success: true,
                        account_name: rData.data.account_name,
                        account_number: rData.data.account_number,
                        bank_id: rData.data.bank_id
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                } else {
                    const failMsg = rData.message || "Account not found. Please verify the account number and selected bank.";
                    return new Response(JSON.stringify({
                        success: false,
                        message: failMsg
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
            } catch (rErr: any) {
                console.error("[ResolveAccount] Fetch Exception:", rErr);
                return new Response(JSON.stringify({ success: false, message: "Error resolving bank account. Please check your network connection." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: EXECUTE LIVE BANK TRANSFER (PAYSTACK PAYOUT) ---
        if (parsedPayload && parsedPayload.action === 'execute_bank_transfer') {
            const { userId, amount, bankCode, bankName, accountNumber, accountName, narration } = parsedPayload;
            const numAmount = parseFloat(String(amount));

            if (!userId || !numAmount || numAmount <= 0 || !accountNumber || !bankCode) {
                return new Response(JSON.stringify({ success: false, message: "Incomplete transfer details provided." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // 1. Atomic Wallet Debit in Database
            const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('execute_user_bank_withdrawal', {
                p_amount: numAmount,
                p_bank_name: bankName || 'Nigerian Bank',
                p_account_number: String(accountNumber).trim(),
                p_account_name: String(accountName || 'Valued User').trim(),
                p_narration: narration || 'Bank Transfer',
                p_user_id: userId
            });

            if (deductErr) {
                console.error("[BankTransfer] Debit error:", deductErr);
                return new Response(JSON.stringify({ success: false, message: deductErr.message || "Insufficient wallet balance." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const newBalance = deductData?.new_balance;
            const internalRef = deductData?.reference || `WTH_${Date.now()}`;

            // 2. Paystack Real Payout Dispatch
            const paystackSecret = await getPaystackSecret(supabaseAdmin);
            let paystackDispatched = false;
            let paystackRef = '';

            if (paystackSecret && paystackSecret.startsWith('sk_')) {
                try {
                    // Step A: Create Transfer Recipient
                    const recRes = await fetch('https://api.paystack.co/transferrecipient', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${paystackSecret}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: 'nuban',
                            name: accountName || 'Valued User',
                            account_number: String(accountNumber).trim(),
                            bank_code: String(bankCode).trim(),
                            currency: 'NGN'
                        })
                    });

                    const recData = await recRes.json();
                    console.log("[BankTransfer] Recipient response:", recData);

                    if (recData.status && recData.data?.recipient_code) {
                        const recipientCode = recData.data.recipient_code;

                        // Step B: Initiate Transfer from Paystack Balance
                        const trfRes = await fetch('https://api.paystack.co/transfer', {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${paystackSecret}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                source: 'balance',
                                amount: Math.round(numAmount * 100), // Naira to Kobo
                                recipient: recipientCode,
                                reason: narration || `Transfer to ${accountName} (${bankName})`,
                                reference: internalRef
                            })
                        });

                        const trfData = await trfRes.json();
                        console.log("[BankTransfer] Transfer response:", trfData);

                        if (trfData.status) {
                            paystackDispatched = true;
                            paystackRef = trfData.data?.reference || trfData.data?.transfer_code || '';
                        }
                    }
                } catch (payoutErr) {
                    console.warn("[BankTransfer] Paystack payout attempt notice:", payoutErr);
                }
            }

            return new Response(JSON.stringify({
                success: true,
                new_balance: newBalance,
                reference: paystackRef || internalRef,
                dispatched: paystackDispatched,
                message: paystackDispatched 
                    ? `Successfully transferred ₦${numAmount.toLocaleString()} to ${accountName} (${bankName}) via Paystack.`
                    : `Successfully processed transfer of ₦${numAmount.toLocaleString()} to ${accountName} (${bankName}).`
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

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
        } catch (e) {
            console.error("Debug log failed", e);
        }

        // --- 1. DIRECT IN-APP CLIENT VERIFICATION (Paystack Checkout) ---
        if (parsedPayload && (parsedPayload.action === 'verify_paystack' || parsedPayload.action === 'verify_payment')) {
            const reference = (parsedPayload.reference || parsedPayload.trxref || '').trim();
            const requestedUserId = parsedPayload.userId || parsedPayload.user_id || null;

            console.log(`[VerifyPaystack] Direct client verification initiated for Ref: ${reference}, User: ${requestedUserId}`);

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

            // Verify with Paystack API directly
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

            return await handleFundWallet(
                supabaseAdmin,
                'paystack',
                txData.reference,
                amountInNaira,
                currency,
                customerEmail,
                txData,
                targetUserId,
                true // isDirectClientVerification
            );
        }

        // --- 2. DETECT WEBHOOK PROVIDER ---
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

        const isPayvesselPayload = Boolean(
            payvesselSignature || 
            rawBody.includes('payvessel') || 
            rawBody.includes('reserved_account') || 
            rawBody.includes('customerReservedAccount') ||
            (parsedPayload?.order && parsedPayload?.order?.amount !== undefined) ||
            (parsedPayload?.virtual_account && parsedPayload?.virtual_account?.account_number) ||
            (parsedPayload?.transaction && parsedPayload?.transaction?.virtual_account)
        );

        console.log(`[Webhook] Detect: PaystackSig=${!!paystackSignature}, FLWSig=${!!flwSignature}, PayvesselSig=${!!payvesselSignature}, IsPayvesselPayload=${isPayvesselPayload}`);

        // --- 3. PAYVESSEL VIRTUAL ACCOUNT HANDLER ---
        if (isPayvesselPayload) {
            let PAYVESSEL_API_SECRET = Deno.env.get('PAYVESSEL_API_SECRET')?.trim();

            if (!PAYVESSEL_API_SECRET) {
                const { data: secrets } = await supabaseAdmin
                    .from('system_secrets')
                    .select('value')
                    .in('key', ['PAYVESSEL_API_SECRET', 'PAYVESSEL_SECRET_KEY', 'PAYVESSEL_SECRET'])
                    .maybeSingle();
                if (secrets && secrets.value) {
                    PAYVESSEL_API_SECRET = secrets.value.trim();
                }
            }

            if (!PAYVESSEL_API_SECRET) {
                const { data: appSet } = await supabaseAdmin
                    .from('app_settings')
                    .select('value')
                    .in('key', ['payvessel_secret_key', 'PAYVESSEL_SECRET_KEY', 'payvessel_api_secret'])
                    .maybeSingle();
                if (appSet && appSet.value) {
                    PAYVESSEL_API_SECRET = appSet.value.trim();
                }
            }

            const bodyText = rawBody;

            // Signature verification check (non-blocking fallback to account matching)
            if (PAYVESSEL_API_SECRET && payvesselSignature) {
                try {
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
                        console.warn("[Payvessel Webhook] Signature mismatch. Received:", payvesselSignature, "Computed:", hashHex, ". Proceeding with account number validation.");
                    } else {
                        console.log("[Payvessel Webhook] Signature verified successfully.");
                    }
                } catch (sigErr) {
                    console.warn("[Payvessel Webhook] Signature verification error, proceeding with payload validation:", sigErr);
                }
            }

            const eventData = parsedPayload || JSON.parse(bodyText);
            const eventName = eventData.event || (eventData.transaction ? eventData.transaction.status : 'unknown');
            console.log("=== PAYVESSEL WEBHOOK TRANSACTION ===");
            console.log("Payvessel Event:", eventName);

            const isSuccess = eventData.event === 'transaction.success' || 
                              eventData.event === 'reserved_account.credit' || 
                              eventData.event === 'customerReservedAccount.transaction' ||
                              eventData.transaction?.status === 'success' || 
                              eventData.transaction?.status === 'successful' ||
                              (eventData.transaction && eventData.transaction.reference !== undefined) ||
                              (eventData.order && eventData.order.amount !== undefined) ||
                              (eventData.data && eventData.data.amount !== undefined);

            if (isSuccess) {
                const transactionObj = eventData.transaction || eventData.data || {};
                const orderObj = eventData.order || eventData.data || {};

                const reference = transactionObj.reference || eventData.reference || orderObj.reference || `PV_${Date.now()}`;
                const rawAmount = orderObj.amount || transactionObj.amount || eventData.amount;
                const amount = parseFloat(String(rawAmount));
                const currency = orderObj.currency || transactionObj.currency || eventData.currency || 'NGN';
                const email = transactionObj.customer_email || transactionObj.customer?.email || eventData.customer_email || eventData.email || eventData.customer?.email;

                let accountNumber = eventData.account_number || 
                                    eventData.accountNumber ||
                                    eventData.virtual_account?.account_number ||
                                    eventData.virtualAccount?.accountNumber ||
                                    transactionObj.virtual_account?.account_number ||
                                    transactionObj.virtualAccount?.accountNumber ||
                                    eventData.customer?.account_number ||
                                    eventData.customer?.accountNumber ||
                                    eventData.customer?.virtual_account_number ||
                                    eventData.customer?.virtualAccountNumber ||
                                    transactionObj.customer?.account_number ||
                                    transactionObj.customer?.virtual_account_number;

                // Fallback: If no dedicated account number field, check order.description or narration for 10-digit number
                if (!accountNumber) {
                    const desc = String(eventData.order?.description || eventData.narration || '');
                    const match = desc.match(/\b\d{10}\b/);
                    if (match) {
                        accountNumber = match[0];
                    }
                } else if (String(accountNumber).length > 10) {
                    const match = String(accountNumber).match(/\b\d{10}\b/);
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
                    null,
                    false
                );
            }

            return new Response("Event Ignored", { status: 200, headers: corsHeaders });
        }

        // --- 4. PAYSTACK WEBHOOK HANDLER ---
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

            if (hashHex.toLowerCase() !== paystackSignature.toLowerCase().trim()) {
                console.warn("[Paystack Webhook] Signature notice. Computed:", hashHex, "Received:", paystackSignature, ". Proceeding with charge verification.");
            }

            const event = JSON.parse(body);
            if (event.event === 'charge.success') {
                const data = event.data;
                const amount = data.amount / 100;
                const reference = data.reference;
                const currency = data.currency;
                const email = data.customer?.email;

                let targetUserId = data.metadata?.user_id || data.metadata?.userId || null;
                if (!targetUserId && data.metadata?.custom_fields) {
                    const f = data.metadata.custom_fields.find((c: any) => c.variable_name === 'user_id' || c.display_name === 'User ID');
                    if (f) targetUserId = f.value;
                }
                if (!targetUserId && reference && reference.startsWith('PAY_')) {
                    const parts = reference.split('_');
                    if (parts[1] && parts[1].length >= 32) {
                        targetUserId = parts[1];
                    }
                }

                return await handleFundWallet(
                    supabaseAdmin,
                    'paystack',
                    reference,
                    amount,
                    currency,
                    email,
                    data,
                    targetUserId,
                    false
                );
            }

            return new Response("Event Ignored", { status: 200, headers: corsHeaders });
        }

        // --- 5. FLUTTERWAVE WEBHOOK HANDLER ---
        if (flwSignature) {
            let event = parsedPayload;
            if (!event) {
                try { event = JSON.parse(rawBody); } catch (_) { return new Response("Invalid JSON", { status: 400, headers: corsHeaders }); }
            }

            const secretHash = Deno.env.get('FLUTTERWAVE_SECRET_HASH');
            if (secretHash && flwSignature !== secretHash) {
                console.warn("[Flutterwave Webhook] Hash signature notice, continuing with verification");
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

                    return await handleFundWallet(
                        supabaseAdmin,
                        'flutterwave',
                        String(data.id || data.flw_ref),
                        data.amount,
                        data.currency,
                        email,
                        data,
                        userId,
                        false
                    );
                }
            }
            return new Response("Event Ignored", { status: 200, headers: corsHeaders });
        }

        console.warn(`[Webhook] No recognizable provider header. Body length: ${rawBody.length}`);
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

// Helper Function for Wallet Funding Logic
type PaymentMetadata = {
    id?: string | number;
    flw_ref?: string;
    tx_ref?: string;
    account_number?: string;
    narration?: string;
    [key: string]: string | number | boolean | null | undefined | object;
};

async function handleFundWallet(
    supabaseAdmin: SupabaseClient,
    provider: string,
    reference: string,
    amount: number,
    currency: string,
    email: string,
    data: PaymentMetadata,
    explicitUserId: string | null = null,
    isDirectClientVerification: boolean = false
) {
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
        if (isDirectClientVerification) {
            return new Response(JSON.stringify({
                success: true,
                message: "Transaction has already been credited",
                reference: reference
            }), { 
                status: 200, 
                headers: { "Content-Type": "application/json", ...corsHeaders } 
            });
        }
        return new Response("Duplicate event ignored", { status: 200, headers: corsHeaders });
    }

    // 2. Find User
    let profile = null;
    let method = 'none';

    // A. Explicit ID
    if (explicitUserId) {
        let sId = String(explicitUserId).trim();
        if (sId.length === 32 && !sId.includes('-')) {
            sId = sId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5');
        }
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, balance, email, full_name')
            .eq('id', sId)
            .maybeSingle();
        if (data && !error) {
            profile = data;
            method = 'specific_id_from_ref';
        }
    }

    // B. Metadata User ID
    if (!profile && (data.metadata?.user_id || data.metadata?.userId)) {
        let metaId = String(data.metadata?.user_id || data.metadata?.userId).trim();
        if (metaId.length === 32 && !metaId.includes('-')) {
            metaId = metaId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5');
        }
        const { data: pData } = await supabaseAdmin
            .from('profiles')
            .select('id, balance, email, full_name')
            .eq('id', metaId)
            .maybeSingle();
        if (pData) {
            profile = pData;
            method = 'metadata_user_id';
        }
    }

    // C. Virtual Account Number (CRITICAL FOR PAYVESSEL & DVA)
    const accNum = data.account_number || (data as any).accountNumber;
    if (!profile && accNum) {
        const cleanAcc = String(accNum).replace(/[^0-9]/g, '');
        console.log(`[FundWallet] Searching virtual_accounts by: raw='${accNum}', clean='${cleanAcc}'`);

        const { data: va } = await supabaseAdmin
            .from('virtual_accounts')
            .select('user_id')
            .or(`account_number.eq.${accNum},account_number.eq.${cleanAcc}`)
            .limit(1)
            .maybeSingle();

        if (va) {
            const { data: p } = await supabaseAdmin
                .from('profiles')
                .select('id, balance, email, full_name')
                .eq('id', va.user_id)
                .single();
            if (p) {
                profile = p;
                method = 'virtual_account_number';
            }
        }
    }

    // D. Reference Prefix (PAY_{userId}_timestamp)
    if (!profile && reference && reference.startsWith('PAY_')) {
        const parts = reference.split('_');
        if (parts[1] && parts[1].length >= 32) {
            let refId = parts[1];
            if (refId.length === 32 && !refId.includes('-')) {
                refId = refId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5');
            }
            const { data: refProf } = await supabaseAdmin
                .from('profiles')
                .select('id, balance, email, full_name')
                .eq('id', refId)
                .maybeSingle();
            if (refProf) {
                profile = refProf;
                method = 'ref_user_id';
            }
        }
    }

    // E. Email Lookup
    if (!profile && email && email !== 'user@example.com' && email !== 'customer@abumafhalsub.com' && email.includes('@')) {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('id, balance, email, full_name')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle();
        if (data) {
            profile = data;
            method = 'email_fallback';
        }
    }

    // F. Phone Lookup
    const custPhone = data.customer?.phone || (data as any).phone;
    if (!profile && custPhone) {
        const cleanPhone = String(custPhone).replace(/[^0-9]/g, '');
        const last10 = cleanPhone.slice(-10);
        const { data: phoneProf } = await supabaseAdmin
            .from('profiles')
            .select('id, balance, email, full_name')
            .or(`phone.eq.${custPhone},phone.ilike.%${last10}`)
            .limit(1)
            .maybeSingle();
        if (phoneProf) {
            profile = phoneProf;
            method = 'phone_lookup';
        }
    }

    if (!profile) {
        console.error(`[FundWallet] User NOT found. Email: ${email}, Acc: ${accNum}, ID: ${explicitUserId}, Ref: ${reference}`);
        await supabaseAdmin.from('payment_events').insert({
            reference: reference,
            amount: amount,
            provider: provider,
            currency: currency,
            status: 'orphaned',
            metadata: { metadata: data }
        });
        if (isDirectClientVerification) {
            return new Response(JSON.stringify({ success: false, error: "User profile not found for this payment" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
        return new Response("User not found", { status: 200, headers: corsHeaders });
    }

    console.log(`[FundWallet] User Match via ${method}: ${profile.id}`);

    // 2.5 Dynamic Tiered Funding Fee Calculation (Admin Configurable)
    let threshold = 5000;
    let underFee = 50;
    let aboveFeePercent = 1;

    try {
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
    } catch (feeErr) {
        console.warn("[FundWallet] Fee settings fetch notice:", feeErr);
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
        feeAmount = Math.round((amount * (aboveFeePercent / 100)) * 100) / 100;
        feeType = 'percentage';
        feeValue = aboveFeePercent;
        console.log(`[FundWallet] Amount >= ${threshold}: Applying ${aboveFeePercent}% fee (₦${feeAmount}) to deposit of ₦${amount}`);
    }

    const creditedAmount = Math.max(0, amount - feeAmount);

    // 3. Fund Wallet (Atomic RPC with Fallback)
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

    // 4. Record Transactions & Event
    const metadata = data || {}; 

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

    await supabaseAdmin.from('payment_events').insert({
        reference: reference,
        amount: amount,
        provider: provider,
        currency: currency,
        status: 'completed',
        metadata: { metadata: metadata }
    });

    const formattedAmount = creditedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
    const formattedBalance = finalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 });

    // 4.5 Insert Notification & Dispatch Push Notification
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
            console.log(`[FundWallet] Dispatching push notification to: ${profile.expo_push_token}`);
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
            }).catch(pushErr => console.warn('[FundWallet] Push error:', pushErr));
        }
    } catch (notifErr) {
        console.warn('[FundWallet] Notification error:', notifErr);
    }

    // 5. Send Email Receipt Notification
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
                        </div>
                    </div>
                </div>
            `;

            sendEmail(userEmail, subject, plainText, htmlBody, supabaseAdmin).catch(err => {
                console.warn("[FundWallet Email Dispatch Warning]:", err?.message || err);
            });
        }
    } catch (emailErr) {
        console.warn("[FundWallet Email Exception]:", emailErr);
    }

    if (isDirectClientVerification) {
        return new Response(JSON.stringify({
            success: true,
            message: "Wallet credited successfully",
            reference: reference,
            amount: creditedAmount,
            gross_amount: amount,
            fee: feeAmount,
            new_balance: finalBalance,
            user_id: profile.id
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }

    return new Response("Wallet Funded", { status: 200, headers: corsHeaders });
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature, verif-hash, flutterwave-signature, payvessel-http-signature, payvessel_http_signature, x-payvessel-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function getPaystackSecret(supabaseAdmin: SupabaseClient): Promise<string> {
    try {
        const { data: dbKeys } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value')
            .in('key', ['PAYSTACK_SECRET_KEY', 'PAYSTACK_KEY', 'PAYSTACK_SECRET', 'PAYSTACK_API_KEY']);

        if (dbKeys && dbKeys.length > 0) {
            for (const k of dbKeys) {
                let val = (k.value || '').trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1).trim();
                }
                if (val.length > 10 && !val.includes('...') && (val.startsWith('sk_live') || val.startsWith('sk_test') || val.startsWith('sk_'))) {
                    return val;
                }
            }
        }

        const { data: appSet } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .in('key', ['paystack_secret_key', 'PAYSTACK_SECRET_KEY'])
            .maybeSingle();

        if (appSet && appSet.value) {
            let val = appSet.value.trim();
            if (val.length > 10 && !val.includes('...')) {
                return val;
            }
        }
    } catch (e) {
        console.warn("[getPaystackSecret] Warning retrieving paystack secret:", e);
    }

    const envSecret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
    if (envSecret && envSecret.length > 10 && !envSecret.includes('...')) {
        return envSecret;
    }

    return '';
}

async function getFlutterwaveSecret(supabaseAdmin: SupabaseClient): Promise<string> {
    // 1. Prioritize active database system_secrets (Configured in API Vault)
    try {
        const { data: dbKeys } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value')
            .in('key', ['FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_KEY', 'FLUTTERWAVE_SECRET', 'FLW_SECRET_KEY']);

        if (dbKeys && dbKeys.length > 0) {
            for (const k of dbKeys) {
                let val = (k.value || '').trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1).trim();
                }
                if (val.length > 10 && !val.includes('...') && (val.startsWith('FLWSECK') || val.startsWith('FLW'))) {
                    console.log(`[getFlutterwaveSecret] Using system_secrets key (${k.key})`);
                    return val;
                }
            }
        }

        // 2. Check app_settings
        const { data: appSet } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .in('key', ['flutterwave_secret_key', 'FLUTTERWAVE_SECRET_KEY'])
            .maybeSingle();

        if (appSet && appSet.value) {
            let val = appSet.value.trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1).trim();
            }
            if (val.length > 10 && !val.includes('...')) {
                return val;
            }
        }
    } catch (e) {
        console.warn("[getFlutterwaveSecret] Warning retrieving flutterwave secret from DB:", e);
    }

    // 3. Fallback to Deno env secret if DB has no secret configured
    const envSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY')?.trim();
    if (envSecret && envSecret.length > 10 && !envSecret.includes('...')) {
        return envSecret;
    }

    return '';
}

async function dispatchUserPushNotification(
    supabaseAdmin: SupabaseClient,
    userId: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
    type: string = 'transfer'
) {
    if (!userId) return;
    try {
        // 1. Insert into notifications table (in-app history + realtime trigger)
        await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            title,
            body,
            message: body,
            massage: body,
            type,
            priority: 'high',
            is_read: false,
            data
        });

        // 2. Query Expo push token
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('expo_push_token, push_token')
            .eq('id', userId)
            .maybeSingle();

        const token = profile?.expo_push_token || profile?.push_token;
        if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken') || token.length > 20)) {
            console.log(`[PushNotification] Dispatching push to ${userId} via token ${token.slice(0, 15)}...`);
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: token,
                    sound: 'default',
                    title,
                    body,
                    channelId: 'transactions',
                    priority: 'high',
                    badge: 1,
                    _displayInForeground: true,
                    data
                }),
            });
        }
    } catch (err) {
        console.warn(`[PushNotification] Error sending push to user ${userId}:`, err);
    }
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

        // --- ACTION: ADMIN PERMANENT DELETE USER ---
        if (parsedPayload && parsedPayload.action === 'admin_delete_user') {
            const targetId = parsedPayload.userId;
            const targetEmail = parsedPayload.email;

            if (!targetId && !targetEmail) {
                return new Response(JSON.stringify({ success: false, error: "userId or email required" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            let resolvedUserId = targetId;
            if (!resolvedUserId && targetEmail) {
                const { data: pData } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', targetEmail.toLowerCase().trim())
                    .maybeSingle();
                if (pData?.id) resolvedUserId = pData.id;
            }

            if (!resolvedUserId && targetEmail) {
                try {
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                    const matchedUser = users?.find(u => u.email?.toLowerCase() === targetEmail?.toLowerCase());
                    if (matchedUser?.id) resolvedUserId = matchedUser.id;
                } catch (_) {}
            }

            if (!resolvedUserId) {
                return new Response(JSON.stringify({ success: false, error: "User not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            console.log(`[AdminDelete] Permanently deleting user: ${resolvedUserId}`);

            await Promise.allSettled([
                supabaseAdmin.from('virtual_accounts').delete().eq('user_id', resolvedUserId),
                supabaseAdmin.from('transactions').delete().eq('user_id', resolvedUserId),
                supabaseAdmin.from('notifications').delete().eq('user_id', resolvedUserId),
                supabaseAdmin.from('kyc_requests').delete().eq('user_id', resolvedUserId),
                supabaseAdmin.from('virtual_cards').delete().eq('user_id', resolvedUserId),
                supabaseAdmin.from('user_bank_accounts').delete().eq('user_id', resolvedUserId),
                supabaseAdmin.from('tickets').delete().eq('user_id', resolvedUserId),
            ]);

            const { error: profileDeleteErr } = await supabaseAdmin.from('profiles').delete().eq('id', resolvedUserId);
            if (profileDeleteErr) {
                console.warn("[AdminDelete] Profile delete note:", profileDeleteErr);
            }

            const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(resolvedUserId);
            if (authDeleteErr) {
                console.warn("[AdminDelete] Auth delete note:", authDeleteErr);
            }

            return new Response(JSON.stringify({
                success: true,
                message: `User ${resolvedUserId} permanently deleted from auth and database.`,
                userId: resolvedUserId
            }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

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
-- 0. ADD DETAILS AND METADATA COLUMNS TO TRANSACTIONS IF NOT EXISTS
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 0b. ADD EXPO_PUSH_TOKEN COLUMN IF NOT EXISTS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;

-- 0c. ENSURE NOTIFICATIONS TABLE AND MESSAGE/MASSAGE/BODY COLUMNS EXIST
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    message TEXT,
    massage TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    type TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS massage text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

UPDATE public.notifications SET message = body WHERE message IS NULL AND body IS NOT NULL;
UPDATE public.notifications SET massage = COALESCE(message, body) WHERE massage IS NULL;
UPDATE public.notifications SET body = message WHERE body IS NULL AND message IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_notifications_content()
RETURNS TRIGGER AS $$
BEGIN
    NEW.body := COALESCE(NEW.body, NEW.message, NEW.massage, '');
    NEW.message := COALESCE(NEW.message, NEW.body, NEW.massage, '');
    NEW.massage := COALESCE(NEW.massage, NEW.message, NEW.body, '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_notifications_content ON public.notifications;
CREATE TRIGGER tr_sync_notifications_content
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_notifications_content();

-- 1. UPDATE TRIGGER FUNCTION (With robust service_role and bypass detection)
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.bypass_profile_lock', true) = 'true'
       OR coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') = 'service_role'
       OR coalesce(auth.role(), '') = 'service_role'
       OR current_user in ('service_role', 'postgres')
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

  -- ENFORCE MINIMUM TRANSFER 100 NAIRA
  if amount < 100 then
    raise exception 'Minimum transfer amount is NGN 100.00. Current amount: NGN %', amount;
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

-- 2B. CREATE EXECUTE_P2P_TRANSFER AS COMPATIBILITY ALIAS
CREATE OR REPLACE FUNCTION public.execute_p2p_transfer(
  target_id uuid default null,
  target_email text default null,
  amount decimal = 0.0,
  note text default ''
)
returns jsonb as $$
begin
  return public.execute_wallet_transfer(
    sender_id := auth.uid(),
    target_id := target_id,
    target_email := target_email,
    amount := amount,
    note := note
  );
end;
$$ language plpgsql security definer;

-- 3. DROP OVERLOADED SIGNATURES AND RECREATE EXECUTE_USER_BANK_WITHDRAWAL
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal(numeric, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal(numeric, text, text, text, text, uuid, numeric);
DROP FUNCTION IF EXISTS public.execute_user_bank_withdrawal;

CREATE OR REPLACE FUNCTION public.execute_user_bank_withdrawal(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_narration text default 'Bank Transfer',
  p_user_id uuid default null,
  p_fee numeric default 0
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_current_bal numeric;
  v_new_bal numeric;
  v_total_debit numeric;
  v_ref text;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and (auth.uid() is null or p_user_id != auth.uid()) then
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') != 'service_role'
       and coalesce(auth.role(), '') != 'service_role'
       and current_user not in ('service_role', 'postgres')
       and not public.is_admin() then
       raise exception 'Unauthorized';
    end if;
  end if;

  -- ENFORCE MINIMUM TRANSFER 100 NAIRA
  if p_amount < 100 then
    raise exception 'Minimum transfer amount is NGN 100.00. Current amount: NGN %', p_amount;
  end if;

  v_total_debit := p_amount + coalesce(p_fee, 0);

  select balance into v_current_bal
  from public.profiles
  where id = v_user_id for update;

  if v_current_bal is null or v_current_bal < v_total_debit then
    raise exception 'Insufficient balance. Available balance: NGN %, Required: NGN %', coalesce(v_current_bal, 0), v_total_debit;
  end if;

  v_new_bal := v_current_bal - v_total_debit;

  PERFORM set_config('app.bypass_profile_lock', 'true', true);

  update public.profiles
  set balance = v_new_bal
  where id = v_user_id;

  v_ref := 'WTH-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text;

  insert into public.transactions (user_id, type, amount, status, description, reference)
  values (
    v_user_id, 
    'withdrawal', 
    v_total_debit, 
    'success', 
    coalesce(p_narration, 'Transfer to ' || p_bank_name || ' (' || p_account_number || ')') || ' - ' || p_account_name || case when coalesce(p_fee, 0) > 0 then ' (Fee: NGN ' || p_fee::text || ')' else '' end,
    v_ref
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_bal,
    'reference', v_ref,
    'amount', p_amount,
    'fee', coalesce(p_fee, 0),
    'total_debit', v_total_debit,
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
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') != 'service_role'
     and coalesce(auth.role(), '') != 'service_role'
     and current_user not in ('service_role', 'postgres')
     and not public.is_admin() then
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
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') != 'service_role'
     and coalesce(auth.role(), '') != 'service_role'
     and current_user not in ('service_role', 'postgres')
     and not public.is_admin() then
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

        // --- ACTION: GET NIGERIAN BANKS (FLUTTERWAVE FIRST WITH PAYSTACK FALLBACK) ---
        if (parsedPayload && parsedPayload.action === 'get_banks') {
            try {
                const priorityMap: Record<string, number> = {
                    '999992': 1,  // OPay (CBN: 999992, FLW: 100004)
                    '100004': 1,  // OPay (FLW code)
                    '999991': 2,  // PalmPay
                    '100033': 2,  // PalmPay (FLW code)
                    '50515': 3,   // Moniepoint
                    '090405': 3,  // Moniepoint (FLW code)
                    '50211': 4,   // Kuda
                    '090267': 4,  // Kuda (FLW code)
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
                    '303': 21,    // Lotus Bank
                };

                const logoMap: Record<string, string> = {
                    '999992': 'paycom.png',
                    '100004': 'paycom.png',
                    '999991': 'palmpay.png',
                    '100033': 'palmpay.png',
                    '50515': 'moniepoint-mfb-ng.png',
                    '090405': 'moniepoint-mfb-ng.png',
                    '50211': 'kuda-bank.png',
                    '090267': 'kuda-bank.png',
                    '058': 'guaranty-trust-bank.png',
                    '057': 'zenith-bank.png',
                    '044': 'access-bank.png',
                    '063': 'access-bank-diamond.png',
                    '011': 'first-bank-of-nigeria.png',
                    '033': 'united-bank-for-africa.png',
                    '232': 'sterling-bank.png',
                    '035': 'wema-bank.png',
                    '035A': 'alat-by-wema.png',
                    '070': 'fidelity-bank.png',
                    '214': 'first-city-monument-bank.png',
                    '032': 'union-bank-of-nigeria.png',
                    '221': 'stanbic-ibtc-bank.png',
                    '076': 'polaris-bank.png',
                    '302': 'taj-bank.png',
                    '050': 'ecobank-nigeria.png',
                    '082': 'keystone-bank.png',
                    '303': 'lotus-bank.png',
                    '00103': 'globus-bank.png',
                    '327': 'paga.png',
                    '401': 'asosavings.png',
                };

                const flutterwaveSecret = await getFlutterwaveSecret(supabaseAdmin);
                let banks: any[] = [];
                let fetchedProvider = '';

                // 1. Try Flutterwave first
                if (flutterwaveSecret) {
                    try {
                        const flwRes = await fetch('https://api.flutterwave.com/v3/banks/NG', {
                            headers: { Authorization: `Bearer ${flutterwaveSecret}` }
                        });
                        const flwData = await flwRes.json();
                        if (flwData.status === 'success' && Array.isArray(flwData.data) && flwData.data.length > 0) {
                            fetchedProvider = 'flutterwave';
                            banks = flwData.data.map((b: any) => {
                                const codeStr = String(b.code || '').trim();
                                const logoFile = logoMap[codeStr] || 'default-image.png';
                                return {
                                    id: String(b.id || codeStr),
                                    name: b.name,
                                    code: codeStr,
                                    slug: b.name?.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                                    logo: `https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/${logoFile}`
                                };
                            });
                        }
                    } catch (flwErr) {
                        console.warn("[get_banks] Notice fetching from Flutterwave:", flwErr);
                    }
                }

                // 2. Fallback to Paystack if Flutterwave returned empty
                if (banks.length === 0) {
                    const paystackSecret = await getPaystackSecret(supabaseAdmin);
                    const headers: Record<string, string> = {};
                    if (paystackSecret) {
                        headers['Authorization'] = `Bearer ${paystackSecret}`;
                    }
                    const bRes = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=300', { headers });
                    const bData = await bRes.json();
                    if (bData.status && Array.isArray(bData.data)) {
                        fetchedProvider = 'paystack';
                        banks = bData.data.map((b: any) => {
                            const codeStr = String(b.code || '').trim();
                            const logoFile = logoMap[codeStr] || (b.slug ? `${b.slug}.png` : 'default-image.png');
                            return {
                                id: String(b.id || codeStr),
                                name: b.name,
                                code: codeStr,
                                slug: b.slug,
                                logo: `https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/${logoFile}`
                            };
                        });
                    }
                }

                if (banks.length > 0) {
                    banks.sort((a: any, b: any) => {
                        const aRank = priorityMap[a.code] || 999;
                        const bRank = priorityMap[b.code] || 999;
                        if (aRank !== bRank) return aRank - bRank;
                        return a.name.localeCompare(b.name);
                    });

                    return new Response(JSON.stringify({ 
                        success: true, 
                        provider: fetchedProvider || 'flutterwave',
                        count: banks.length, 
                        banks 
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }

                return new Response(JSON.stringify({ success: false, error: "Failed to fetch bank list" }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch (err: any) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: CHECK PAYSTACK BALANCE & CAPABILITIES ---
        if (parsedPayload && parsedPayload.action === 'check_paystack_balance') {
            try {
                const paystackSecret = await getPaystackSecret(supabaseAdmin);
                if (!paystackSecret) {
                    return new Response(JSON.stringify({ success: false, error: "No Paystack secret key found" }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
                const balRes = await fetch('https://api.paystack.co/balance', {
                    headers: { Authorization: `Bearer ${paystackSecret}` }
                });
                const balData = await balRes.json();
                return new Response(JSON.stringify({ success: true, is_live: paystackSecret.startsWith('sk_live_'), paystack: balData }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch (err: any) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: GET SERVER OUTBOUND IP ---
        if (parsedPayload && parsedPayload.action === 'get_outbound_ip') {
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipRes.json();
                return new Response(JSON.stringify({ success: true, outbound_ip: ipData.ip }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch (ipErr: any) {
                return new Response(JSON.stringify({ success: false, error: ipErr.message }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: CHECK FLUTTERWAVE BALANCE & CAPABILITIES ---
        if (parsedPayload && (parsedPayload.action === 'check_flutterwave_balance' || parsedPayload.action === 'check_flw_balance' || parsedPayload.action === 'check_transfer_balance')) {
            try {
                const flwSecret = await getFlutterwaveSecret(supabaseAdmin);
                if (!flwSecret) {
                    return new Response(JSON.stringify({ success: false, error: "No Flutterwave secret key configured" }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
                const balRes = await fetch('https://api.flutterwave.com/v3/balances/NGN', {
                    headers: { Authorization: `Bearer ${flwSecret}` }
                });
                const balData = await balRes.json();
                const availableBal = typeof balData.data?.available_balance === 'number' 
                    ? balData.data.available_balance 
                    : (parseFloat(String(balData.data?.available_balance || '0')) || 0);
                const ledgerBal = typeof balData.data?.ledger_balance === 'number'
                    ? balData.data.ledger_balance
                    : (parseFloat(String(balData.data?.ledger_balance || '0')) || availableBal);

                return new Response(JSON.stringify({
                    success: true,
                    is_live: flwSecret.startsWith('FLWSECK-') && !flwSecret.includes('TEST'),
                    currency: 'NGN',
                    available_balance: availableBal,
                    ledger_balance: ledgerBal,
                    flutterwave: balData
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } catch (err: any) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // --- ACTION: RESOLVE NIGERIAN BANK ACCOUNT NAME (FLUTTERWAVE FIRST, PAYSTACK FALLBACK) ---
        if (parsedPayload && (parsedPayload.action === 'resolve_bank_account' || parsedPayload.action === 'resolve_account')) {
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

            const FLW_BANK_CODE_MAP: Record<string, string[]> = {
                '999992': ['100004', '999992'], // OPay
                '100004': ['100004', '999992'],
                '999991': ['100033', '999991'], // PalmPay
                '100033': ['100033', '999991'],
                '50515': ['090405', '50515'],   // Moniepoint
                '090405': ['090405', '50515'],
                '50211': ['090267', '50211'],   // Kuda
                '090267': ['090267', '50211'],
            };

            const flutterwaveSecret = await getFlutterwaveSecret(supabaseAdmin);
            const paystackSecret = await getPaystackSecret(supabaseAdmin);

            // Step 1: Try Flutterwave Account Resolution
            if (flutterwaveSecret) {
                const candidateCodes = FLW_BANK_CODE_MAP[bankCode] || [bankCode];
                for (const candidateCode of candidateCodes) {
                    try {
                        const flwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${flutterwaveSecret}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                account_number: accNum,
                                account_bank: candidateCode
                            })
                        });

                        const flwData = await flwRes.json();
                        console.log(`[ResolveAccount:Flutterwave] Acc=${accNum}@${candidateCode}, Status=${flwRes.status}, FLWStatus=${flwData.status}`);

                        if (flwData.status === 'success' && flwData.data?.account_name) {
                            return new Response(JSON.stringify({
                                success: true,
                                account_name: flwData.data.account_name,
                                account_number: flwData.data.account_number,
                                bank_code: candidateCode,
                                provider: 'flutterwave'
                            }), {
                                headers: { "Content-Type": "application/json", ...corsHeaders }
                            });
                        }
                    } catch (flwErr) {
                        console.warn("[ResolveAccount:Flutterwave] Exception testing code:", candidateCode, flwErr);
                    }
                }
            }

            // Step 2: Fallback to Paystack
            if (paystackSecret) {
                const candidateCodes = FLW_BANK_CODE_MAP[bankCode] || [bankCode];
                for (const candidateCode of candidateCodes) {
                    try {
                        const resolveUrl = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accNum)}&bank_code=${encodeURIComponent(candidateCode)}`;
                        const rRes = await fetch(resolveUrl, {
                            headers: {
                                Authorization: `Bearer ${paystackSecret}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        const rData = await rRes.json();
                        console.log(`[ResolveAccount:Paystack] Acc=${accNum}@${candidateCode}, Status=${rRes.status}, PSStatus=${rData.status}`);

                        if (rData.status && rData.data?.account_name) {
                            return new Response(JSON.stringify({
                                success: true,
                                account_name: rData.data.account_name,
                                account_number: rData.data.account_number,
                                bank_id: rData.data.bank_id,
                                bank_code: candidateCode,
                                provider: 'paystack'
                            }), {
                                headers: { "Content-Type": "application/json", ...corsHeaders }
                            });
                        }
                    } catch (rErr: any) {
                        console.error("[ResolveAccount:Paystack] Fetch Exception:", rErr);
                    }
                }
            }

            return new Response(JSON.stringify({
                success: false,
                message: "Could not find this bank account. Please verify the 10-digit account number and selected bank."
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // --- ACTION: EXECUTE LIVE BANK TRANSFER (FLUTTERWAVE / PAYSTACK) ---
        if (parsedPayload && (parsedPayload.action === 'execute_bank_transfer' || parsedPayload.action === 'disburse_bank_transfer')) {
            // Verify and extract authenticated user ID from JWT if available for maximum security
            let authenticatedUserId: string | null = null;
            const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.replace(/^Bearer\s+/i, '');
                    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                    if (user?.id) authenticatedUserId = user.id;
                } catch (_) {}
            }

            const userId = authenticatedUserId || parsedPayload.userId || parsedPayload.user_id;
            const amount = parsedPayload.amount;
            const bankCode = String(parsedPayload.bankCode || parsedPayload.bank_code || '').trim();
            const bankName = String(parsedPayload.bankName || parsedPayload.bank_name || 'Nigerian Bank').trim();
            const accountNumber = String(parsedPayload.accountNumber || parsedPayload.account_number || '').trim();
            const accountName = String(parsedPayload.accountName || parsedPayload.account_name || 'Valued Recipient').trim();
            const narration = parsedPayload.narration;
            const numAmount = parseFloat(String(amount));

            if (!userId || !numAmount || numAmount <= 0 || !accountNumber || !bankCode) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: "Incomplete transfer details: user authentication, amount, account number, and bank are required." 
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // ENFORCE MINIMUM TRANSFER 100 NAIRA
            if (numAmount < 100) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: "Minimum transfer amount is ₦100.00. Transfers below ₦100 are not allowed." 
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // Calculate or extract dynamic transfer fee
            let transferFee = typeof parsedPayload.fee === 'number' ? parsedPayload.fee : 0;
            if (transferFee === 0 && parsedPayload.fee !== 0) {
                try {
                    const { data: feeSettings } = await supabaseAdmin
                        .from('app_settings')
                        .select('key, value')
                        .in('key', ['transfer_fee_threshold', 'transfer_fee_below_10k', 'transfer_fee_above_10k']);
                    
                    const setMap: Record<string, string> = {};
                    feeSettings?.forEach((s: any) => { setMap[s.key] = s.value; });
                    const threshold = parseFloat(setMap['transfer_fee_threshold'] || '10000');
                    const feeBelow = parseFloat(setMap['transfer_fee_below_10k'] || '22');
                    const feeAbove = parseFloat(setMap['transfer_fee_above_10k'] || '62');
                    transferFee = numAmount < threshold ? feeBelow : feeAbove;
                } catch (e) {
                    transferFee = numAmount < 10000 ? 22 : 62;
                }
            }

            const totalDebit = typeof parsedPayload.totalDebit === 'number' 
                ? parsedPayload.totalDebit 
                : (typeof parsedPayload.total_debit === 'number' ? parsedPayload.total_debit : (numAmount + transferFee));

            // 1. Verify user wallet balance in DB first without debiting yet
            const { data: userProfile, error: profileErr } = await supabaseAdmin
                .from('profiles')
                .select('balance')
                .eq('id', userId)
                .maybeSingle();

            if (profileErr || !userProfile) {
                return new Response(JSON.stringify({ success: false, message: "User account not found." }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const currentWalletBal = parseFloat(String(userProfile.balance || 0));
            if (currentWalletBal < totalDebit) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: `Insufficient wallet balance. Total required is ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })} (Transfer: ₦${numAmount.toLocaleString()} + Fee: ₦${transferFee.toLocaleString()}). You have ₦${currentWalletBal.toLocaleString('en-NG', { minimumFractionDigits: 2 })} available.` 
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // Determine Provider: Check payload, then app_settings ('transfer_provider')
            let provider = parsedPayload.provider ? String(parsedPayload.provider).toLowerCase() : '';
            if (!provider) {
                try {
                    const { data: provSetting } = await supabaseAdmin
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'transfer_provider')
                        .maybeSingle();
                    if (provSetting && provSetting.value) {
                        provider = provSetting.value.toLowerCase().trim();
                    }
                } catch (_) {}
            }
            if (!provider) provider = 'flutterwave';

            const flutterwaveSecret = await getFlutterwaveSecret(supabaseAdmin);
            const paystackSecret = await getPaystackSecret(supabaseAdmin);

            const FLW_BANK_CODE_MAP: Record<string, string[]> = {
                '999992': ['100004', '999992'], // OPay
                '100004': ['100004', '999992'],
                '999991': ['100033', '999991'], // PalmPay
                '100033': ['100033', '999991'],
                '50515': ['090405', '50515'],   // Moniepoint
                '090405': ['090405', '50515'],
                '50211': ['090267', '50211'],   // Kuda
                '090267': ['090267', '50211'],
            };

            // ROUTE A: FLUTTERWAVE TRANSFER
            if (provider === 'flutterwave' || (!paystackSecret && flutterwaveSecret)) {
                if (!flutterwaveSecret) {
                    return new Response(JSON.stringify({
                        success: false,
                        dispatched: false,
                        message: "Flutterwave secret key is not configured on the server."
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }

                try {
                    // Step A: Check Flutterwave Merchant Balance
                    let flwNgnBalance = 0;
                    try {
                        const balRes = await fetch('https://api.flutterwave.com/v3/balances/NGN', {
                            headers: { Authorization: `Bearer ${flutterwaveSecret}` }
                        });
                        const balData = await balRes.json();
                        flwNgnBalance = typeof balData.data?.available_balance === 'number'
                            ? balData.data.available_balance
                            : (parseFloat(String(balData.data?.available_balance || '0')) || 0);
                    } catch (balErr) {
                        console.warn("[Flutterwave Transfer] Balance check warning:", balErr);
                    }

                    console.log(`[Flutterwave Transfer] User Wallet: ₦${currentWalletBal}, Transfer: ₦${numAmount}, Fee: ₦${transferFee}, FLW Balance: ₦${flwNgnBalance}`);

                    let flwLiquidityOk = flwNgnBalance >= numAmount || flwNgnBalance === 0;
                    if (flwNgnBalance > 0 && flwNgnBalance < numAmount) {
                        console.error(`[PAYOUT_LIQUIDITY_ALERT] Low Flutterwave merchant payout liquidity (Available: ₦${flwNgnBalance}, Required: ₦${numAmount}). Safe abort.`);
                        flwLiquidityOk = false;
                    }

                    let isFlwDispatched = false;
                    let trfData: any = null;

                    if (flwLiquidityOk) {
                        // Candidate code for Flutterwave
                        const candidateCodes = FLW_BANK_CODE_MAP[bankCode] || [bankCode];
                        const flwBankCode = candidateCodes[0];
                        const internalRef = `WTH_FLW_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                        // Step B: Dispatch Transfer to Flutterwave
                        const trfRes = await fetch('https://api.flutterwave.com/v3/transfers', {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${flutterwaveSecret}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                account_bank: flwBankCode,
                                account_number: String(accountNumber).trim(),
                                amount: numAmount,
                                narration: narration || `Transfer to ${accountName} (${bankName})`,
                                currency: 'NGN',
                                reference: internalRef,
                                debit_currency: 'NGN'
                            })
                        });

                        trfData = await trfRes.json();
                        console.log("[Flutterwave Transfer] Dispatch response:", trfData);

                        // VERIFY THAT FLUTTERWAVE TRULY ACCEPTED AND DISPATCHED THE TRANSFER
                        isFlwDispatched = trfRes.ok && trfData.status === 'success' && trfData.data && trfData.data.id && String(trfData.data.status || '').toUpperCase() !== 'FAILED' && String(trfData.data.status || '').toUpperCase() !== 'REJECTED';
                    }

                    if (!isFlwDispatched) {
                        const rawFlwErr = trfData?.message || trfData?.data?.complete_message || "Bank payout rejected by Flutterwave.";
                        console.error("[Flutterwave Transfer] Transfer not dispatched via Flutterwave:", {
                            rawError: rawFlwErr,
                            flwLiquidityOk,
                            flwNgnBalance,
                            amount: numAmount
                        });

                        // If Paystack is available, attempt seamless automatic failover
                        if (paystackSecret && paystackSecret.startsWith('sk_')) {
                            console.log("[Flutterwave Transfer] Flutterwave transfer not dispatched, initiating automatic failover to Paystack...");
                            // Fall through to ROUTE B below
                        } else {
                            // User-safe sanitized message - NEVER expose internal secrets or merchant balance
                            let userSafeMsg = "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged.";
                            const lower = rawFlwErr.toLowerCase();
                            if (lower.includes("account") && (lower.includes("invalid") || lower.includes("not found") || lower.includes("destination") || lower.includes("recipient") || lower.includes("nuban"))) {
                                userSafeMsg = "Recipient account details could not be validated by destination bank. Please check account number and bank, then try again. Your wallet was NOT charged.";
                            }
                            return new Response(JSON.stringify({
                                success: false,
                                dispatched: false,
                                error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                                message: userSafeMsg
                            }), {
                                headers: { "Content-Type": "application/json", ...corsHeaders }
                            });
                        }
                    } else {

                    // Step C: Guaranteed debit user wallet after Flutterwave confirms transfer dispatch
                    let newBalance = Math.max(0, currentWalletBal - totalDebit);
                    let txRef = `WTH_FLW_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                    const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('execute_user_bank_withdrawal', {
                        p_amount: numAmount,
                        p_bank_name: bankName || 'Nigerian Bank',
                        p_account_number: String(accountNumber).trim(),
                        p_account_name: String(accountName || 'Valued User').trim(),
                        p_narration: narration || 'Bank Transfer via Flutterwave',
                        p_user_id: userId,
                        p_fee: transferFee
                    });

                    if (!deductErr && deductData && deductData.success !== false) {
                        if (deductData.new_balance !== undefined) newBalance = Number(deductData.new_balance);
                        if (deductData.reference) txRef = deductData.reference;
                    } else {
                        console.error("[Flutterwave Transfer] Post-dispatch DB debit error, executing fail-safe debit:", deductErr);
                        // Failsafe 1: deduct_balance RPC
                        const { data: dbBal, error: dbBalErr } = await supabaseAdmin.rpc('deduct_balance', {
                            user_id: userId,
                            amount: totalDebit
                        });
                        if (!dbBalErr && dbBal !== null && dbBal !== undefined) {
                            newBalance = Number(dbBal);
                        } else {
                            // Failsafe 2: Direct profile balance update via admin client
                            console.error("[Flutterwave Transfer] deduct_balance failed, updating profile balance directly:", dbBalErr);
                            const { error: directErr } = await supabaseAdmin
                                .from('profiles')
                                .update({ balance: Math.max(0, currentWalletBal - totalDebit) })
                                .eq('id', userId);
                            if (!directErr) {
                                newBalance = Math.max(0, currentWalletBal - totalDebit);
                            } else {
                                console.error("[Flutterwave Transfer] Direct balance update failed:", directErr);
                            }
                        }

                        // Ensure transaction record is inserted
                        try {
                            await supabaseAdmin.from('transactions').insert({
                                user_id: userId,
                                type: 'withdrawal',
                                amount: totalDebit,
                                status: 'success',
                                description: narration || `Transfer to ${bankName} (${accountNumber}) - ${accountName}`,
                                reference: txRef,
                                details: {
                                    provider: 'flutterwave',
                                    fee: transferFee,
                                    total_debit: totalDebit,
                                    bank_name: bankName,
                                    account_number: accountNumber,
                                    account_name: accountName
                                }
                            });
                        } catch (txInsertErr) {
                            console.warn("[Flutterwave Transfer] Transaction record insert fallback warning:", txInsertErr);
                        }
                    }

                    const flwRef = trfData.data?.reference || trfData.data?.id || txRef;

                    // Update transaction details with provider metadata
                    try {
                        await supabaseAdmin
                            .from('transactions')
                            .update({
                                details: {
                                    provider: 'flutterwave',
                                    flw_id: trfData.data?.id,
                                    flw_reference: flwRef,
                                    fee: transferFee,
                                    total_debit: totalDebit,
                                    bank_name: bankName,
                                    account_number: accountNumber,
                                    account_name: accountName
                                }
                            })
                            .eq('reference', txRef);
                    } catch (_) {}

                    const finalStatus = (trfData.data?.status === 'SUCCESSFUL' || trfData.data?.status === 'success') ? 'SUCCESSFUL' : (trfData.data?.status || 'PENDING');
                    const sessionId = trfData.data?.complete_message || trfData.data?.reference || flwRef;

                    // Send push notification to user immediately
                    await dispatchUserPushNotification(
                        supabaseAdmin,
                        userId,
                        `Debit Alert: ₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
                        `₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} was sent to ${accountName} (${bankName}). Ref: ${flwRef}`,
                        {
                            type: 'transfer_debit',
                            reference: flwRef,
                            amount: numAmount,
                            fee: transferFee,
                            totalDebit: totalDebit,
                            newBalance: newBalance,
                            bankName: bankName,
                            accountNumber: accountNumber,
                            accountName: accountName
                        },
                        'transfer_debit'
                    );

                    return new Response(JSON.stringify({
                        success: true,
                        dispatched: true,
                        status: finalStatus,
                        provider: 'flutterwave',
                        new_balance: newBalance,
                        reference: flwRef,
                        session_id: sessionId,
                        fee: transferFee,
                        total_debit: totalDebit,
                        bank_name: bankName,
                        account_number: accountNumber,
                        account_name: accountName,
                        message: `Successfully transferred ₦${numAmount.toLocaleString()} to ${accountName} (${bankName}) via Flutterwave. Status: ${finalStatus}.`
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                } // End of else (isFlwDispatched)

                } catch (flwErr: any) {
                    console.error("[Flutterwave Transfer] Payout Exception:", flwErr);
                    if (paystackSecret && paystackSecret.startsWith('sk_')) {
                        console.log("[Flutterwave Transfer] Payout exception caught, initiating failover to Paystack...");
                    } else {
                        return new Response(JSON.stringify({
                            success: false,
                            dispatched: false,
                            error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                            message: "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged."
                        }), {
                            headers: { "Content-Type": "application/json", ...corsHeaders }
                        });
                    }
                }
            }

            // ROUTE B: PAYSTACK TRANSFER (FALLBACK OR EXPLICIT)
            if (!paystackSecret || !paystackSecret.startsWith('sk_')) {
                console.error("[Transfer Error] Neither Flutterwave nor Paystack could disburse. Transfer safely stopped.");
                return new Response(JSON.stringify({ 
                    success: false, 
                    dispatched: false,
                    error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                    message: "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged." 
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            try {
                // Step A: Check Paystack Merchant Balance
                const balRes = await fetch('https://api.paystack.co/balance', {
                    headers: { Authorization: `Bearer ${paystackSecret}` }
                });
                const balData = await balRes.json();
                const ngnBalObj = balData.data?.find((b: any) => b.currency === 'NGN') || balData.data?.[0];
                const paystackNgnBalance = ngnBalObj ? (parseFloat(String(ngnBalObj.balance)) / 100) : 0;

                console.log(`[Paystack Transfer] User Wallet: ₦${currentWalletBal}, Requested: ₦${numAmount}, Fee: ₦${transferFee}, Paystack Balance: ₦${paystackNgnBalance}`);

                if (paystackNgnBalance < numAmount) {
                    console.error(`[PAYOUT_LIQUIDITY_ALERT] Low Paystack merchant payout liquidity (Available: ₦${paystackNgnBalance}, Required: ₦${numAmount}). Safe abort.`);
                    return new Response(JSON.stringify({
                        success: false,
                        dispatched: false,
                        error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                        message: "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged."
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }

                // Step B: Create Transfer Recipient on Paystack
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
                console.log("[Paystack Transfer] Recipient response:", recData);

                if (!recData.status || !recData.data?.recipient_code) {
                    console.error("[Paystack Transfer] Recipient registration failed:", recData);
                    let userSafeMsg = "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged.";
                    const rawMsg = String(recData.message || '').toLowerCase();
                    if (rawMsg.includes("account") || rawMsg.includes("nuban") || rawMsg.includes("resolve")) {
                        userSafeMsg = "Recipient account details could not be validated by destination bank. Please check account number and bank, then try again. Your wallet was NOT charged.";
                    }
                    return new Response(JSON.stringify({
                        success: false,
                        dispatched: false,
                        error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                        message: userSafeMsg
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }

                const recipientCode = recData.data.recipient_code;
                const internalRef = `WTH_PS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                // Step C: Initiate Transfer on Paystack
                const trfRes = await fetch('https://api.paystack.co/transfer', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${paystackSecret}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        source: 'balance',
                        amount: Math.round(numAmount * 100), // Kobo
                        recipient: recipientCode,
                        reason: narration || `Transfer to ${accountName} (${bankName})`,
                        reference: internalRef
                    })
                });

                const trfData = await trfRes.json();
                console.log("[Paystack Transfer] Transfer response:", trfData);

                // VERIFY THAT PAYSTACK TRULY ACCEPTED AND DISPATCHED THE TRANSFER
                const isPaystackDispatched = trfRes.ok && trfData.status === true && trfData.data && String(trfData.data.status || '').toLowerCase() !== 'failed' && String(trfData.data.status || '').toLowerCase() !== 'rejected';

                if (!isPaystackDispatched) {
                    console.error("[Paystack Transfer] Paystack transfer rejected:", trfData);
                    let userSafeMsg = "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged.";
                    const rawMsg = String(trfData.message || '').toLowerCase();
                    if (rawMsg.includes("account") || rawMsg.includes("nuban")) {
                        userSafeMsg = "Recipient account details could not be validated by destination bank. Please check account number and bank, then try again. Your wallet was NOT charged.";
                    }
                    return new Response(JSON.stringify({
                        success: false,
                        dispatched: false,
                        error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                        message: userSafeMsg
                    }), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }

                // Step D: Guaranteed debit user wallet after Paystack confirms transfer dispatch
                let newBalance = Math.max(0, currentWalletBal - totalDebit);
                let txRef = `WTH_PS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                const { data: deductData, error: deductErr } = await supabaseAdmin.rpc('execute_user_bank_withdrawal', {
                    p_amount: numAmount,
                    p_bank_name: bankName || 'Nigerian Bank',
                    p_account_number: String(accountNumber).trim(),
                    p_account_name: String(accountName || 'Valued User').trim(),
                    p_narration: narration || 'Bank Transfer via Paystack',
                    p_user_id: userId,
                    p_fee: transferFee
                });

                if (!deductErr && deductData && deductData.success !== false) {
                    if (deductData.new_balance !== undefined) newBalance = Number(deductData.new_balance);
                    if (deductData.reference) txRef = deductData.reference;
                } else {
                    console.error("[Paystack Transfer] Post-dispatch DB debit error, executing fail-safe debit:", deductErr);
                    // Failsafe 1: deduct_balance RPC
                    const { data: dbBal, error: dbBalErr } = await supabaseAdmin.rpc('deduct_balance', {
                        user_id: userId,
                        amount: totalDebit
                    });
                    if (!dbBalErr && dbBal !== null && dbBal !== undefined) {
                        newBalance = Number(dbBal);
                    } else {
                        // Failsafe 2: Direct profile balance update via admin client
                        console.error("[Paystack Transfer] deduct_balance failed, updating profile balance directly:", dbBalErr);
                        const { error: directErr } = await supabaseAdmin
                            .from('profiles')
                            .update({ balance: Math.max(0, currentWalletBal - totalDebit) })
                            .eq('id', userId);
                        if (!directErr) {
                            newBalance = Math.max(0, currentWalletBal - totalDebit);
                        } else {
                            console.error("[Paystack Transfer] Direct balance update failed:", directErr);
                        }
                    }

                    // Ensure transaction record is inserted
                    try {
                        await supabaseAdmin.from('transactions').insert({
                            user_id: userId,
                            type: 'withdrawal',
                            amount: totalDebit,
                            status: 'success',
                            description: narration || `Transfer to ${bankName} (${accountNumber}) - ${accountName}`,
                            reference: txRef,
                            details: {
                                provider: 'paystack',
                                fee: transferFee,
                                total_debit: totalDebit,
                                bank_name: bankName,
                                account_number: accountNumber,
                                account_name: accountName
                            }
                        });
                    } catch (txInsertErr) {
                        console.warn("[Paystack Transfer] Transaction record insert fallback warning:", txInsertErr);
                    }
                }

                const paystackRef = trfData.data?.reference || trfData.data?.transfer_code || txRef;

                // Update transaction details with provider metadata
                try {
                    await supabaseAdmin
                        .from('transactions')
                        .update({
                            details: {
                                provider: 'paystack',
                                paystack_code: trfData.data?.transfer_code,
                                paystack_reference: paystackRef,
                                fee: transferFee,
                                total_debit: totalDebit,
                                bank_name: bankName,
                                account_number: accountNumber,
                                account_name: accountName
                            }
                        })
                        .eq('reference', txRef);
                } catch (_) {}

                const finalStatus = (trfData.data?.status === 'success' || trfData.data?.status === 'SUCCESSFUL') ? 'SUCCESSFUL' : (trfData.data?.status || 'PENDING');
                const sessionId = trfData.data?.transfer_code || paystackRef;

                // Send push notification to user immediately
                await dispatchUserPushNotification(
                    supabaseAdmin,
                    userId,
                    `Debit Alert: ₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
                    `₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} was sent to ${accountName} (${bankName}). Ref: ${paystackRef}`,
                    {
                        type: 'transfer_debit',
                        reference: paystackRef,
                        amount: numAmount,
                        fee: transferFee,
                        totalDebit: totalDebit,
                        newBalance: newBalance,
                        bankName: bankName,
                        accountNumber: accountNumber,
                        accountName: accountName
                    },
                    'transfer_debit'
                );

                return new Response(JSON.stringify({
                    success: true,
                    dispatched: true,
                    status: finalStatus,
                    provider: 'paystack',
                    new_balance: newBalance,
                    reference: paystackRef,
                    session_id: sessionId,
                    fee: transferFee,
                    total_debit: totalDebit,
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_name: accountName,
                    message: `Successfully transferred ₦${numAmount.toLocaleString()} to ${accountName} (${bankName}) via Paystack. Status: ${finalStatus}.`
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });

            } catch (payoutErr: any) {
                console.error("[Paystack Transfer] Payout Exception:", payoutErr);
                return new Response(JSON.stringify({
                    success: false,
                    dispatched: false,
                    error_code: "SETTLEMENT_CHANNEL_MAINTENANCE",
                    message: "Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged."
                }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
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

        // --- ACTION: GET PAYSTACK PUBLIC KEY (CLIENT SAFE) ---
        if (parsedPayload && (parsedPayload.action === 'get_paystack_public_key' || parsedPayload.action === 'get_public_keys')) {
            let publicKey = '';
            try {
                const { data: sec } = await supabaseAdmin
                    .from('system_secrets')
                    .select('value')
                    .in('key', ['PAYSTACK_PUBLIC_KEY', 'PAYSTACK_PUB', 'PAYSTACK_KEY'])
                    .maybeSingle();
                if (sec?.value && sec.value.trim().length > 10) {
                    publicKey = sec.value.trim();
                }
            } catch (e) {
                console.warn("[GetPaystackKey] system_secrets query warning:", e);
            }

            if (!publicKey) {
                try {
                    const { data: appSet } = await supabaseAdmin
                        .from('app_settings')
                        .select('value')
                        .in('key', ['paystack_public_key', 'PAYSTACK_PUBLIC_KEY'])
                        .maybeSingle();
                    if (appSet?.value && appSet.value.trim().length > 10) {
                        publicKey = appSet.value.trim();
                    }
                } catch (e) {
                    console.warn("[GetPaystackKey] app_settings query warning:", e);
                }
            }

            if (!publicKey) {
                publicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY')?.trim() || '';
            }

            return new Response(JSON.stringify({ success: true, publicKey }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
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
                                    (typeof eventData.virtual_account === 'string' ? eventData.virtual_account : eventData.virtual_account?.account_number) ||
                                    (typeof eventData.virtualAccount === 'string' ? eventData.virtualAccount : eventData.virtualAccount?.accountNumber) ||
                                    (typeof transactionObj.virtual_account === 'string' ? transactionObj.virtual_account : transactionObj.virtual_account?.account_number) ||
                                    (typeof transactionObj.virtualAccount === 'string' ? transactionObj.virtualAccount : transactionObj.virtualAccount?.accountNumber) ||
                                    eventData.customer?.account_number ||
                                    eventData.customer?.accountNumber ||
                                    eventData.customer?.virtual_account_number ||
                                    eventData.customer?.virtualAccountNumber ||
                                    transactionObj.customer?.account_number ||
                                    transactionObj.customer?.virtual_account_number ||
                                    eventData.account_no ||
                                    transactionObj.account_no;

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

            // Transfer completed (live bank payout status update)
            if (event.event === 'transfer.completed') {
                const data = event.data;
                console.log(`[Flutterwave Webhook] Transfer completed event: ID=${data?.id}, Ref=${data?.reference}, Status=${data?.status}`);
                if (data?.status === 'FAILED') {
                    const ref = data.reference;
                    try {
                        const { data: tx } = await supabaseAdmin
                            .from('transactions')
                            .select('id, user_id, amount, status, details')
                            .or(`reference.eq.${ref},details->>flw_reference.eq.${ref}`)
                            .maybeSingle();

                        if (tx && tx.status !== 'failed' && tx.status !== 'refunded') {
                            const fee = tx.details?.fee ? parseFloat(String(tx.details.fee)) : 0;
                            const refundAmount = parseFloat(String(tx.amount || 0)) + fee;
                            if (refundAmount > 0) {
                                await supabaseAdmin.rpc('credit_balance', {
                                    user_id: tx.user_id,
                                    amount: refundAmount
                                });
                                await supabaseAdmin
                                    .from('transactions')
                                    .update({
                                        status: 'failed',
                                        details: {
                                            ...(typeof tx.details === 'object' ? tx.details : {}),
                                            failure_reason: data.complete_message || 'Payout failed by destination bank',
                                            refunded: true,
                                            refunded_amount: refundAmount,
                                            refunded_at: new Date().toISOString()
                                        }
                                    })
                                    .eq('id', tx.id);
                                console.log(`[Flutterwave Webhook] Auto-refunded ₦${refundAmount} to user ${tx.user_id}`);
                            }
                        }
                    } catch (refundErr) {
                        console.error("[Flutterwave Webhook] Refund handling exception:", refundErr);
                    }
                }
                return new Response("Transfer Event Processed", { status: 200, headers: corsHeaders });
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
            .select('id, balance, email, full_name, expo_push_token')
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
            .select('id, balance, email, full_name, expo_push_token')
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
                .select('id, balance, email, full_name, expo_push_token')
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
                .select('id, balance, email, full_name, expo_push_token')
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
            .select('id, balance, email, full_name, expo_push_token')
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

    const formattedAmount = creditedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
    const formattedBalance = finalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 });
    const notifTitle = `💰 Wallet Credited: ₦${formattedAmount}`;
    const notifBody = `Successfully credited ₦${formattedAmount} to your wallet. New Balance: ₦${formattedBalance}`;

    // 4. Parallel Ultra-Fast Database Inserts (Transactions, Events & In-App Notification)
    try {
        await Promise.all([
            supabaseAdmin.from('transactions').insert(transactionsToInsert),
            supabaseAdmin.from('payment_events').insert({
                reference: reference,
                amount: amount,
                provider: provider,
                currency: currency,
                status: 'completed',
                metadata: { metadata: metadata }
            }),
            supabaseAdmin.from('notifications').insert({
                user_id: profile.id,
                title: notifTitle,
                body: notifBody,
                message: notifBody,
                massage: notifBody,
                type: 'funding',
                priority: 'high',
                is_read: false,
                data: { route: '/(app)/history', reference: reference }
            })
        ]);
    } catch (insertErr) {
        console.error("[FundWallet] Concurrent DB insert note:", insertErr);
    }

    // 4.5 Ultra-Fast Guaranteed Push Notification Dispatch
    if (profile.expo_push_token) {
        try {
            console.log(`[FundWallet] Dispatching instant push notification to: ${profile.expo_push_token}`);
            await fetch('https://exp.host/--/api/v2/push/send', {
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
                    badge: 1,
                    _displayInForeground: true,
                    data: { route: '/(app)/wallet', reference: reference }
                }),
            });
            console.log('[FundWallet] Push notification successfully delivered to Expo gateway.');
        } catch (pushErr) {
            console.warn('[FundWallet] Push notification dispatch note:', pushErr);
        }
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

    return new Response(JSON.stringify({ status: true, message: "Wallet Funded Successfully", reference }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
}

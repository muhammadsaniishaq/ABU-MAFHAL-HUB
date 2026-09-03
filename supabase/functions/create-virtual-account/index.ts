import { createClient } from "@supabase/supabase-js";
import { createPayvesselDVA } from "../_shared/payvessel.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Missing Internal Configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        }

        const requestBody = await req.json().catch(() => ({}));
        const { userId, bvn, forceSecondAccount, forceUpdate } = requestBody;
        const safeBvn = bvn ? String(bvn).trim() : undefined;

        if (!userId) {
            throw new Error("Missing User ID");
        }

        // Initialize Supabase Admin Client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 1. Fetch User Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            throw new Error("Profile not found: " + (profileError?.message || 'Unknown'));
        }

        // 2. Fetch all existing virtual accounts for user
        const { data: existingAccounts } = await supabaseAdmin
            .from('virtual_accounts')
            .select('id, user_id, provider, bank_name, account_number, account_name, currency, metadata, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        const existingList = existingAccounts || [];

        // If user already has 2 or more accounts and not explicitly forcing update with a new BVN
        if (existingList.length >= 2 && !forceUpdate && !safeBvn) {
            return new Response(JSON.stringify({
                status: "success",
                message: "Virtual accounts already active",
                accounts: existingList,
                primary: existingList[0],
                secondary: existingList[1] || null,
                ...existingList[0]
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // If user already has 1 account and didn't provide a BVN / force second account
        if (existingList.length === 1 && !safeBvn && !forceSecondAccount && !forceUpdate && !profile.bvn) {
            return new Response(JSON.stringify({
                status: "success",
                message: "Primary virtual account active",
                accounts: existingList,
                primary: existingList[0],
                secondary: null,
                ...existingList[0]
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3. BVN and NIN Retrieval & Profile sync
        let userBVN = profile.bvn ? String(profile.bvn).trim() : null;
        let userNIN = profile.nin ? String(profile.nin).trim() : null;

        // If BVN is provided explicitly in request, use it and update profile
        if (safeBvn && safeBvn.length >= 10) {
            console.log("BVN provided in request. Updating profile...");
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ bvn: safeBvn, kyc_tier: Math.max(Number(profile.kyc_tier) || 1, 2) })
                .eq('id', userId);
            
            if (updateError) {
                 console.error("Failed to update profile with BVN:", updateError);
            }
            userBVN = safeBvn;
        }

        if (!userBVN || !userNIN) {
             // Check if they have a 'bvn' or 'nin' record in kyc_requests
             const { data: kycs } = await supabaseAdmin
                .from('kyc_requests')
                .select('admin_note, status, document_number, document_type')
                .eq('user_id', userId)
                .in('document_type', ['bvn', 'nin'])
                .order('created_at', { ascending: false });

             if (kycs && kycs.length > 0) {
                 if (!userBVN) {
                     const bvnKyc = kycs.find(k => k.document_type === 'bvn');
                     if (bvnKyc) {
                         if (bvnKyc.document_number && bvnKyc.document_number.length >= 10) {
                             userBVN = bvnKyc.document_number;
                             await supabaseAdmin.from('profiles').update({ bvn: userBVN }).eq('id', userId);
                         } else {
                             const match = bvnKyc.admin_note?.match(/ID:\s*(\d{11})/);
                             if (match && match[1]) {
                                 userBVN = match[1];
                                 await supabaseAdmin.from('profiles').update({ bvn: userBVN }).eq('id', userId);
                             }
                         }
                     }
                 }

                 if (!userNIN) {
                     const ninKyc = kycs.find(k => k.document_type === 'nin');
                     if (ninKyc) {
                         if (ninKyc.document_number && ninKyc.document_number.length >= 10) {
                             userNIN = ninKyc.document_number;
                         } else {
                             const match = ninKyc.admin_note?.match(/ID:\s*(\d{11})/);
                             if (match && match[1]) {
                                 userNIN = match[1];
                             }
                         }
                     }
                 }
             }
        }

        // 4. Fetch Credentials from DB (system_secrets & app_settings)
        const { data: secrets } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value');

        const { data: appSettings } = await supabaseAdmin
            .from('app_settings')
            .select('key, value');

        const allSecretsMap: Record<string, string> = {};
        if (appSettings) {
            appSettings.forEach(s => { if (s.key && s.value) allSecretsMap[s.key.toUpperCase()] = s.value; });
        }
        if (secrets) {
            secrets.forEach(s => { if (s.key && s.value) allSecretsMap[s.key.toUpperCase()] = s.value; });
        }

        const findSecret = (...keys: string[]): string => {
            for (const k of keys) {
                const upper = k.toUpperCase();
                if (allSecretsMap[upper] && allSecretsMap[upper].trim()) {
                    return allSecretsMap[upper].trim();
                }
                const env = Deno.env.get(k) || Deno.env.get(upper);
                if (env && env.trim()) return env.trim();
            }
            return '';
        };

        const pvConfig = {
            apiKey: findSecret('PAYVESSEL_API_KEY', 'PAYVESSEL_KEY', 'PAYBESSEL_API_KEY'),
            apiSecret: findSecret('PAYVESSEL_API_SECRET', 'PAYVESSEL_SECRET_KEY', 'PAYVESSEL_SECRET'),
            businessId: findSecret('PAYVESSEL_BUSINESS_ID', 'PAYVESSEL_BUSINESS', 'PAYVESSEL_BIZ_ID'),
        };

        // Fallback default BVN/NIN if configured by platform
        if (!userBVN && !userNIN) {
            userBVN = findSecret('BUSINESS_BVN', 'DEFAULT_BVN', 'PLATFORM_BVN') || null;
            userNIN = findSecret('BUSINESS_NIN', 'DEFAULT_NIN', 'PLATFORM_NIN') || null;
        }

        // 5. Create Payvessel DVA (Requests both 9PSB 120001 & PalmPay 999991)
        const userEmail = profile.email;
        const userName = profile.full_name || 'Valued Customer';
        const userPhone = profile.phone || '08000000000';

        console.log(`Creating Payvessel DVA for ${userEmail} (BVN: ${userBVN ? 'present' : 'none'}, NIN: ${userNIN ? 'present' : 'none'})`);
        let payvesselRes = await createPayvesselDVA({
            email: userEmail,
            name: userName,
            phone: userPhone,
            bvn: userBVN || undefined,
            nin: userNIN || undefined,
            bankcode: ["120001", "999991"] // 9PSB and PalmPay
        }, pvConfig);

        if (!payvesselRes.status || !payvesselRes.banks || payvesselRes.banks.length === 0) {
            console.error("Payvessel DVA response warning:", payvesselRes.message);
            // If already have at least 1 account, return it instead of failing
            if (existingList.length > 0) {
                return new Response(JSON.stringify({
                    status: "partial_success",
                    message: payvesselRes.message || "Using existing virtual account",
                    accounts: existingList,
                    primary: existingList[0],
                    secondary: existingList[1] || null,
                    ...existingList[0]
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            }
            throw new Error(payvesselRes.message || "Payvessel account creation failed. Verify Payvessel API keys and user BVN/NIN.");
        }

        // 6. Save/Update All Returned Banks to DB
        const savedAccounts = [];
        for (const bank of payvesselRes.banks) {
            const bankAccountData = {
                user_id: userId,
                provider: 'payvessel',
                bank_name: bank.bankName,
                account_number: bank.accountNumber,
                account_name: bank.accountName || userName.toUpperCase(),
                currency: 'NGN',
                metadata: { ...bank, full_response: payvesselRes }
            };

            // Check if this account number already exists
            const { data: existingBank } = await supabaseAdmin
                .from('virtual_accounts')
                .select('id, account_number')
                .eq('account_number', bank.accountNumber)
                .maybeSingle();

            if (existingBank) {
                const { data: updated } = await supabaseAdmin
                    .from('virtual_accounts')
                    .update(bankAccountData)
                    .eq('id', existingBank.id)
                    .select('id, user_id, provider, bank_name, account_number, account_name, currency, created_at')
                    .single();
                if (updated) savedAccounts.push(updated);
            } else {
                // Check if user already has an entry for this bank_name
                const { data: existingUserBank } = await supabaseAdmin
                    .from('virtual_accounts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('bank_name', bank.bankName)
                    .maybeSingle();

                if (existingUserBank) {
                    const { data: updated } = await supabaseAdmin
                        .from('virtual_accounts')
                        .update(bankAccountData)
                        .eq('id', existingUserBank.id)
                        .select('id, user_id, provider, bank_name, account_number, account_name, currency, created_at')
                        .single();
                    if (updated) savedAccounts.push(updated);
                } else {
                    const { data: inserted, error: insertErr } = await supabaseAdmin
                        .from('virtual_accounts')
                        .insert(bankAccountData)
                        .select('id, user_id, provider, bank_name, account_number, account_name, currency, created_at')
                        .single();

                    if (insertErr) {
                        console.warn(`Insert virtual account error (${bank.bankName}):`, insertErr.message);
                    } else if (inserted) {
                        savedAccounts.push(inserted);
                    }
                }
            }
        }

        // Fetch authoritative refreshed list of user accounts
        const { data: finalAccounts } = await supabaseAdmin
            .from('virtual_accounts')
            .select('id, user_id, provider, bank_name, account_number, account_name, currency, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        const resultAccounts = (finalAccounts && finalAccounts.length > 0) ? finalAccounts : savedAccounts;
        const primaryAccount = resultAccounts[0] || null;
        const secondaryAccount = resultAccounts[1] || null;

        return new Response(JSON.stringify({
            status: "success",
            message: `Successfully generated ${resultAccounts.length} virtual account(s)`,
            accounts: resultAccounts,
            primary: primaryAccount,
            secondary: secondaryAccount,
            ...(primaryAccount || {})
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: unknown) {
        console.error("Create DVA Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
        return new Response(JSON.stringify({ 
            status: "error",
            error: errorMessage,
            details: error instanceof Error ? error.stack : undefined
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400, 
        });
    }
});


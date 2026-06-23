// Removed std/http/server.ts import
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

        const { userId, bvn } = await req.json();
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

        // 2. Check if already has virtual account
        const { data: existingAccount } = await supabaseAdmin
            .from('virtual_accounts')
            .select('id, user_id, provider, bank_name, account_number, account_name, currency')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingAccount) {
            return new Response(JSON.stringify(existingAccount), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3. BVN and NIN Retrieval logic
        let userBVN = profile.bvn;
        let userNIN = null;

        // If BVN is provided explicitly in request, use it and update profile
        if (safeBvn && safeBvn.length >= 10) {
            console.log("BVN provided in request. Updating profile...");
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ bvn: safeBvn })
                .eq('id', userId);
            
            if (updateError) {
                 console.error("Failed to update profile with BVN:", updateError);
            }
            userBVN = safeBvn;
        }

        if (!userBVN) {
             console.log("BVN missing in profile, searching kyc_requests...");
             // Check if they have a 'bvn' or 'nin' record in kyc_requests
             const { data: kycs } = await supabaseAdmin
                .from('kyc_requests')
                .select('admin_note, status, document_number, document_type')
                .eq('user_id', userId)
                .in('document_type', ['bvn', 'nin'])
                .order('created_at', { ascending: false });

             if (kycs && kycs.length > 0) {
                 // Try to retrieve BVN
                 const bvnKyc = kycs.find(k => k.document_type === 'bvn');
                 if (bvnKyc) {
                     if (bvnKyc.document_number && bvnKyc.document_number.length >= 10) {
                         userBVN = bvnKyc.document_number;
                         console.log("BVN found in kyc_requests document_number. Auto-repairing profile...");
                         await supabaseAdmin.from('profiles').update({ bvn: userBVN }).eq('id', userId);
                     } else {
                         const match = bvnKyc.admin_note?.match(/ID:\s*(\d{11})/);
                         if (match && match[1]) {
                             userBVN = match[1];
                             console.log("BVN found in KYC logs (admin_note). Auto-repairing profile...");
                             await supabaseAdmin.from('profiles').update({ bvn: userBVN }).eq('id', userId);
                         }
                     }
                 }

                 // Try to retrieve NIN if BVN not found
                 if (!userBVN) {
                     const ninKyc = kycs.find(k => k.document_type === 'nin');
                     if (ninKyc) {
                         if (ninKyc.document_number && ninKyc.document_number.length >= 10) {
                             userNIN = ninKyc.document_number;
                             console.log("NIN found in kyc_requests document_number.");
                         } else {
                             const match = ninKyc.admin_note?.match(/ID:\s*(\d{11})/);
                             if (match && match[1]) {
                                 userNIN = match[1];
                                 console.log("NIN found in KYC logs (admin_note).");
                             }
                         }
                     }
                 }
             }

             if (!userBVN && !userNIN) {
                return new Response(JSON.stringify({ 
                    error: "BVN Required", 
                    message: "Please complete your BVN or NIN verification to generate a virtual account." 
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200, 
                });
             }
        }

        // 3.5 Fetch Payvessel Credentials from DB
        const { data: secrets } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value')
            .in('key', ['PAYVESSEL_API_KEY', 'PAYVESSEL_API_SECRET', 'PAYVESSEL_BUSINESS_ID']);

        const getSecret = (keyName: string) => secrets?.find(s => s.key === keyName)?.value || Deno.env.get(keyName) || '';

        const pvConfig = {
            apiKey: getSecret('PAYVESSEL_API_KEY'),
            apiSecret: getSecret('PAYVESSEL_API_SECRET'),
            businessId: getSecret('PAYVESSEL_BUSINESS_ID'),
        };

        // 4. Create Payvessel DVA
        const userEmail = profile.email;
        const userName = profile.full_name || 'Valued User';
        const userPhone = profile.phone || '08000000000';

        console.log(`Creating Payvessel DVA for ${userEmail}`);
        const payvesselRes = await createPayvesselDVA({
            email: userEmail,
            name: userName,
            phone: userPhone,
            bvn: userBVN || undefined,
            nin: userNIN || undefined
        }, pvConfig);

        if (!payvesselRes.status || !payvesselRes.banks || payvesselRes.banks.length === 0) {
            throw new Error(payvesselRes.message || "Payvessel account creation failed");
        }

        // 5. Save to DB (Primary Bank)
        const primaryBank = payvesselRes.banks[0];
        const virtualAccountData = {
            user_id: userId,
            provider: 'payvessel',
            bank_name: primaryBank.bankName,
            account_number: primaryBank.accountNumber,
            account_name: primaryBank.accountName,
            currency: 'NGN', 
            metadata: payvesselRes // Keep the full array and response payload
        };

        const { data: newAccount, error: insertError } = await supabaseAdmin
            .from('virtual_accounts')
            .insert(virtualAccountData)
            .select('id, user_id, provider, bank_name, account_number, account_name, currency')
            .single();

        if (insertError) {
            throw new Error("DB Insert Error: " + insertError.message);
        }

        return new Response(JSON.stringify(newAccount), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: unknown) {
        console.error("Create DVA Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
        return new Response(JSON.stringify({ 
            error: errorMessage,
            details: error instanceof Error ? error.stack : undefined
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, 
        });
    }
});

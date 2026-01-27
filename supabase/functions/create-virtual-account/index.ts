// Removed std/http/server.ts import
import { createClient } from "@supabase/supabase-js";
import { createFlutterwaveDVA } from "../_shared/flutterwave.ts";

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

        const { userId } = await req.json();

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

        // 3. New Requirement: BVN Check for Flutterwave + Smart Retrieval
        let userBVN = profile.bvn;

        if (!userBVN) {
             console.log("BVN missing in profile, searching kyc_requests...");
             // Check if they have a 'bvn' record in kyc_requests (even if pending/approved)
             // We prioritize 'approved', but strictly speaking if they submitted it, we might want to try it.
             // Let's filter by document_type='bvn'
             const { data: kycs } = await supabaseAdmin
                .from('kyc_requests')
                .select('admin_note, status')
                .eq('user_id', userId)
                .eq('document_type', 'bvn')
                .order('created_at', { ascending: false })
                .limit(1);

             if (kycs && kycs.length > 0) {
                 const bestKyc = kycs[0];
                 // Often the BVN is stored in 'admin_note' or we don't have it explicitly if we didn't save it in a column.
                 // In our verify-identity logic, we logged: `Verified Identity via API. ID: ${idNumber}...` in admin_note.
                 // We can try to extract it from admin_note using regex if we are desperate.
                 // Regex: ID: (\d{11})
                 const match = bestKyc.admin_note?.match(/ID:\s*(\d{11})/);
                 if (match && match[1]) {
                     userBVN = match[1];
                     console.log("Details found in KYC logs. Auto-repairing profile...");
                     
                     // Auto-Repair Profile
                     await supabaseAdmin.from('profiles').update({ bvn: userBVN }).eq('id', userId);
                 }
             }

             if (!userBVN) {
                return new Response(JSON.stringify({ 
                    error: "BVN Required", 
                    message: "Please complete your BVN verification to generate a virtual account." 
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200, 
                });
             }
        }

        // 4. Create Flutterwave DVA
        const userEmail = profile.email;
        const userName = profile.full_name || 'Valued User';
        const splitName = userName.split(' ');
        const firstName = splitName[0];
        const lastName = splitName.slice(1).join(' ') || firstName;
        const userPhone = profile.phone || '08000000000';



        console.log(`Creating Flutterwave DVA for ${userEmail}`);

        const tx_ref = `dva_${userId}_${Date.now()}`;
        const flwRes = await createFlutterwaveDVA(userEmail, userBVN, 'Wallet Funding', firstName, lastName, userPhone, tx_ref);

        if (flwRes.status !== 'success' || !flwRes.data) {
            throw new Error(flwRes.message || "Flutterwave creation failed");
        }

        // 5. Save to DB
        // Fix: Ensure we match the exact schema fields
        const virtualAccountData = {
            user_id: userId,
            provider: 'flutterwave',
            bank_name: flwRes.data.bank_name,
            account_number: flwRes.data.account_number,
            account_name: userName, // FLW DVA sometimes returns order ref as name, better use profile name or check 'note'
            currency: 'NGN', 
            metadata: flwRes.data
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
        // Return 200 but with error field so client can read message
        return new Response(JSON.stringify({ 
            error: errorMessage,
            details: error instanceof Error ? error.stack : undefined
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, 
        });
    }
});

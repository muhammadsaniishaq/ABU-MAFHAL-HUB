
// Removed old serve import in favor of Deno.serve
import { createClient } from "@supabase/supabase-js";
import { verifyBVN, verifyNIN } from "../_shared/flutterwave.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!FLUTTERWAVE_SECRET_KEY) {
            console.error("FLUTTERWAVE_SECRET_KEY is not set");
            return new Response(JSON.stringify({ 
                success: false, 
                error: "Configuration Error: FLUTTERWAVE_SECRET_KEY is missing in Supabase secrets." 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            });
        }

        const body = await req.json();
        console.log("Received Body:", body);

        const { idType, idNumber, userId } = body;

        if (!idType || !idNumber || !userId) {
            console.error("Missing fields:", { idType, idNumber, userId });
            return new Response(JSON.stringify({ success: false, error: "Missing required fields (idType, idNumber, userId)" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 1. Fetch User Profile to compare Name
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error("Profile Error:", profileError);
            return new Response(JSON.stringify({ 
                success: false, 
                error: "Database Error: Could not fetch profile.",
                details: profileError?.message || "Profile not found"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // 2. Call Flutterwave
        console.log(`Verifying ${idType} : ${idNumber}`);
        let verificationData: any = null;
        let apiStatus = '';
        let apiMessage = '';

        try {
            if (idType === 'bvn') {
                const res = await verifyBVN(idNumber);
                console.log("BVN Res:", res);
                apiStatus = res.status;
                apiMessage = res.message;
                verificationData = res.data;
            } else if (idType === 'nin') {
                const res = await verifyNIN(idNumber);
                console.log("NIN Res:", res);
                apiStatus = res.status;
                apiMessage = res.message;
                verificationData = res.data;
            } else {
                return new Response(JSON.stringify({ success: false, error: "Invalid ID Type" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                });
            }
        } catch (apiError: any) {
            console.error("Flutterwave API Exception:", apiError);
            throw new Error(`External API Error: ${apiError.message}`);
        }

        // 3. Logic: Check if API call was successful
        if (apiStatus !== 'success' || !verificationData) {
            const errorMsg = apiMessage || "Verification failed at provider";
            console.warn("Verification Failed at Provider:", { apiStatus, apiMessage });
            return new Response(JSON.stringify({ success: false, error: errorMsg }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // 4. Secure Name Matching
        const fwFirstName = verificationData.first_name?.toLowerCase() || '';
        const fwLastName = verificationData.last_name?.toLowerCase() || '';
        const userFullName = profile.full_name?.toLowerCase() || '';

        // Match if any part of the name matches
        const isVerified = userFullName.includes(fwLastName) || userFullName.includes(fwFirstName);

        if (!isVerified) {
            console.log("Name Mismatch:", { userFullName, fwFirstName, fwLastName });
            return new Response(JSON.stringify({
                success: false,
                message: "Name mismatch. Please ensure your profile name matches your ID.",
                details: {
                    profileName: userFullName,
                    idName: `${fwFirstName} ${fwLastName}`
                }
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200, // Return 200 so the app can show the message clearly
            });
        }

        // 5. Success: Upgrade User
        const { error: updateError } = await supabaseAdmin.from('profiles').update({ kyc_tier: 2 }).eq('id', userId);
        if (updateError) {
            console.error("Scale Tier Update Error:", updateError);
            throw updateError;
        }

        const { error: logError } = await supabaseAdmin.from('kyc_requests').insert({
            user_id: userId,
            document_type: idType,
            document_url: 'verified_via_api',
            status: 'approved',
            admin_note: `Auto-verified via Flutterwave. ID: ${idNumber}`
        });
        if (logError) console.error("KYC Request Log Error:", logError);

        // 6. Assign Virtual Account (PAYSTACK)
        let virtualAccountData = null;
        try {
            const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (authUser && authUser.email) {
                 // Import Dynamically or ensure import at top
                 const { createPaystackDVA } = await import('../_shared/paystack.ts');
                 
                 const firstName = fwFirstName || userFullName.split(' ')[0];
                 const lastName = fwLastName || userFullName.split(' ').slice(1).join(' ');
                 const phone = profile.phone || '08000000000'; // Fallback

                 console.log(`Creating Paystack Account for ${authUser.email}...`);
                 const paystackRes = await createPaystackDVA(authUser.email, firstName, lastName, phone);

                 if (paystackRes.status && paystackRes.data) {
                    virtualAccountData = {
                        user_id: userId,
                        provider: 'paystack',
                        bank_name: paystackRes.data.bank.name,
                        account_number: paystackRes.data.account_number,
                        account_name: paystackRes.data.account_name,
                        currency: paystackRes.data.currency,
                        meta_data: paystackRes.data
                    };

                    const { error: vaError } = await supabaseAdmin.from('virtual_accounts').insert(virtualAccountData);
                    if (vaError) console.error("VA Insert Error:", vaError);
                 } else {
                     console.error("Paystack Creation Failed:", paystackRes.message);
                 }
            }
        } catch (vaEx) {
            console.error("Virtual Account Config Error:", vaEx);
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Identity Verified Successfully!",
            data: verificationData
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Server Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message || "Internal Server Error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});

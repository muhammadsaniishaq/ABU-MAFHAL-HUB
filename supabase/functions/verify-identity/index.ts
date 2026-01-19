
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyBVN, verifyNIN } from "../_shared/flutterwave.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
    }

    try {
        const { idType, idNumber, userId } = await req.json();

        if (!idType || !idNumber || !userId) {
            throw new Error("Missing required fields");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 1. Fetch User Profile to compare Name
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        if (!profile) throw new Error("User not found");

        // 2. Call Flutterwave
        let verificationData: any = null;
        let apiStatus = '';
        let apiMessage = '';

        if (idType === 'bvn') {
            const res = await verifyBVN(idNumber);
            apiStatus = res.status;
            apiMessage = res.message;
            verificationData = res.data;
        } else if (idType === 'nin') {
            const res = await verifyNIN(idNumber);
            apiStatus = res.status;
            apiMessage = res.message;
            verificationData = res.data;
        } else {
            throw new Error("Invalid ID Type");
        }

        // 3. Logic: Check if API call was successful
        if (apiStatus !== 'success' || !verificationData) {
            throw new Error(`Verification Failed: ${apiMessage}`);
        }

        // 4. Secure Name Matching (Basic Implementation)
        // We compare if the first name or last name from FW appears in the user's profile name.
        // In production, use Leventshtein distance or stricter checks.

        const fwFirstName = verificationData.first_name?.toLowerCase() || '';
        const fwLastName = verificationData.last_name?.toLowerCase() || '';
        const userFullName = profile.full_name?.toLowerCase() || '';

        const nameMatch = userFullName.includes(fwFirstName) && userFullName.includes(fwLastName);

        // Allow partial match (at least one name) for better UX in MVP, or strict for security.
        // Let's do: at least Last Name must match + one other name is better.
        // For now: Simple "includes" check of the FW names in the Profile name.

        const isVerified = userFullName.includes(fwLastName) || userFullName.includes(fwFirstName);

        if (!isVerified) {
            return new Response(JSON.stringify({
                success: false,
                message: "Name mismatch. Please ensure your profile name matches your ID.",
                details: {
                    profileName: userFullName,
                    idName: `${fwFirstName} ${fwLastName}`
                }
            }), {
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
                status: 200,
            });
        }

        // 5. Success: Upgrade User
        // Update Profile Tier
        await supabaseAdmin.from('profiles').update({ kyc_tier: 2 }).eq('id', userId);

        // Create Approved Request Record
        await supabaseAdmin.from('kyc_requests').insert({
            user_id: userId,
            document_type: idType,
            document_url: 'verified_via_api',
            status: 'approved',
            admin_note: `Auto-verified via Flutterwave. ID: ${idNumber}`
        });

        return new Response(JSON.stringify({
            success: true,
            message: "Identity Verified Successfully!",
            data: verificationData
        }), {
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
            status: 400,
        });
    }
});

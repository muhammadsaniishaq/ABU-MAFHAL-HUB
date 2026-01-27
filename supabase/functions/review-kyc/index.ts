
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { requestId, action, adminNote } = body; // action: 'approve' | 'reject'

        if (!requestId || !action) {
            return new Response(JSON.stringify({ success: false, error: "Missing requestId or action" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 1. Fetch Request
        const { data: request, error: reqError } = await supabaseAdmin
            .from('kyc_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (reqError || !request) {
            return new Response(JSON.stringify({ success: false, error: "Request not found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 404,
            });
        }

        if (request.status !== 'pending') {
             return new Response(JSON.stringify({ success: false, error: "Request is not pending" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // Fetch User Profile for Email
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', request.user_id)
            .single();

        if (!profile) {
            throw new Error("User profile not found");
        }

        // 2. Handle Rejection
        if (action === 'reject') {
            await supabaseAdmin.from('kyc_requests').update({
                status: 'rejected',
                admin_note: adminNote
            }).eq('id', requestId);

            // Send Rejection Email
            console.log(`Sending rejection email to ${profile.email}`);
            await sendEmail(
                profile.email,
                "KYC Update: Request Rejected",
                `Dear ${profile.full_name}, your KYC request has been rejected. Reason: ${adminNote || 'Document issues'}. Please review and try again.`
            );
            
            return new Response(JSON.stringify({ success: true, message: "Request Rejected and Email Sent" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3. Handle Approval
        if (action === 'approve') {
             // Up Level Logic
             // If document based, usually we determine tier from document type or just incr
             // For simplicity, let's look at user's current tier and increment
             
             const currentTier = profile.kyc_tier || 0;
             const newTier = currentTier + 1;

             // UPDATE PROFILE
             await supabaseAdmin.from('profiles').update({ kyc_tier: newTier }).eq('id', request.user_id);
             
             // UPDATE REQUEST
             // This status change will trigger 'assign-dva' webhook if applicable
             // BUT for reliability, we also trigger it explicitly here (idempotent)
             const { data: updatedRequest, error: updateError } = await supabaseAdmin
                 .from('kyc_requests')
                 .update({
                     status: 'approved',
                     admin_note: adminNote || 'Approved by Admin'
                 })
                 .eq('id', requestId)
                 .select()
                 .single();

             if (updateError) throw updateError;
             
             // Trigger assign-dva
             console.log("Triggering assign-dva function...");
             const assignDvaUrl = `${supabaseUrl}/functions/v1/assign-dva`;
             fetch(assignDvaUrl, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${supabaseServiceRoleKey}`
                 },
                 body: JSON.stringify({
                     record: updatedRequest,
                     old_record: { ...request, status: 'pending' }
                 })
             }).then(res => {
                 if (!res.ok) return res.text().then(t => console.error("Assign DVA Failed:", t));
                 console.log("Assign DVA Triggered Successfully");
             }).catch(err => console.error("Failed to call assign-dva:", err));

             // Send Approval Email
             console.log(`Sending approval email to ${profile.email}`);
             await sendEmail(
                profile.email,
                "KYC Update: Congratulations!",
                `Dear ${profile.full_name}, your KYC request has been approved. You are now Tier ${newTier}.`
            );
             
             return new Response(JSON.stringify({ 
                 success: true, 
                 message: `Approved. Upgraded to Tier ${newTier}.`,
             }), {
                 headers: { ...corsHeaders, "Content-Type": "application/json" },
                 status: 200,
             });
        }

        return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });

    } catch (error: unknown) {
        console.error("Review Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return new Response(JSON.stringify({ success: false, error: errorMessage }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});

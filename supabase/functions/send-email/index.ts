import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uagcxrtdqttayulvgpwg.supabase.co';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Server Configuration Error");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const body = await req.json();
        const { to, from = 'admin@abumafhal.com.ng', subject, text, html } = body;

        if (!to || !subject || (!text && !html)) {
            return new Response(JSON.stringify({ error: "Missing required fields (to, subject, text/html)" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1. Send Email via Resend / SMTP
        const dispatchResult = await sendEmail(to, subject, text || '', html, supabaseAdmin);

        const isSuccess = dispatchResult?.success === true;
        const errorMessage = dispatchResult?.error || (isSuccess ? null : "Email delivery failed via active providers");

        return new Response(JSON.stringify({
            success: isSuccess,
            message: isSuccess ? "Official Email dispatched successfully" : "Email delivery failed",
            error: errorMessage,
            dispatchResult
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("[send-email Edge Error]:", error);
        return new Response(JSON.stringify({ error: error.message || "Email dispatch failed" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

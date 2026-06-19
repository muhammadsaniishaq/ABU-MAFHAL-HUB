
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendEmail } from "../_shared/email.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const { to } = await req.json();

        if (!to) {
            return new Response(JSON.stringify({ error: "Missing 'to' email address" }), {
                headers: { "Content-Type": "application/json" },
                status: 400,
            });
        }

        const info = await sendEmail(
            to,
            "Test Email from Supabase",
            "This is a test email sent from your Supabase Edge Function via Zoho Mail.",
            "<h1>Test Email</h1><p>This is a test email sent from your Supabase Edge Function via <b>Zoho Mail</b>.</p>"
        );

        return new Response(JSON.stringify({ message: "Email sent successfully", info }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});

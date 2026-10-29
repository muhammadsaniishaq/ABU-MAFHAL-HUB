
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { sendEmail } from "../_shared/email.ts";
import { renderAbuMafhalEmailTemplate } from "../_shared/email-template.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uagcxrtdqttayulvgpwg.supabase.co';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const { to } = await req.json();

        if (!to) {
            return new Response(JSON.stringify({ error: "Missing 'to' email address" }), {
                headers: { "Content-Type": "application/json" },
                status: 400,
            });
        }

        const testHtml = renderAbuMafhalEmailTemplate({
            recipientName: 'Valued Partner',
            headlineBadge: 'Test Verification',
            headlineTitle: 'Official Mail Gateway Test',
            headlineSubtitle: 'Fast, secure and affordable digital services in one app.',
            greeting: 'Hi there 👋',
            messageBody: 'This is an official test notification confirming that the <strong>Abu Mafhal Sub</strong> mail delivery engine and UI template are active and functioning at 100% capacity.',
            buttonText: 'Open ABU MAFHAL SUB &rarr;',
            buttonUrl: 'https://abumafhal.com.ng'
        });

        const info = await sendEmail(
            to,
            "Official Gateway Verification - ABU MAFHAL SUB",
            "This is an official test notification confirming that Abu Mafhal Sub email gateway is functioning properly.",
            testHtml,
            supabaseAdmin
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

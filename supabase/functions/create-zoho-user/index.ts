import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";

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
        const { username, fullName, password } = body;

        if (!username || !fullName) {
            return new Response(JSON.stringify({ error: "Missing required fields (username, fullName)" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
        const targetEmail = `${cleanUsername}@abumafhal.com.ng`;
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || cleanUsername;
        const lastName = nameParts.slice(1).join(' ') || 'Admin';

        // 1. Fetch Zoho OAuth & Org Secrets from system_secrets table (with updated defaults)
        let dbSecrets: any[] = [];
        try {
            const { data } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID']);
            if (data) dbSecrets = data;
        } catch (e) {
            console.warn("DB Secrets fetch note:", e);
        }

        const getVal = (k: string) => dbSecrets?.find(s => s.key === k)?.value?.trim();

        // Active OAuth credentials
        const clientId = Deno.env.get('ZOHO_CLIENT_ID') || getVal('ZOHO_CLIENT_ID') || '1000.XGFAO3DIJ6T334FTCGSB9DL0DIUILH';
        const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET') || getVal('ZOHO_CLIENT_SECRET') || '03c230ab9c0dcdfb89c8c2bd19377f9d8c45e97946';
        const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN') || getVal('ZOHO_REFRESH_TOKEN') || '1000.41b0c57b16431f016940f6307c7d86a2.ed49962afa8bb1a966c848f51962f46f';
        const orgId = Deno.env.get('ZOHO_ORG_ID') || getVal('ZOHO_ORG_ID') || '911972993';

        // Auto-save these active credentials into system_secrets using service_role
        try {
            await supabaseAdmin.from('system_secrets').upsert([
                { key: 'ZOHO_ORG_ID', value: orgId, description: 'Zoho Organization ID' },
                { key: 'ZOHO_CLIENT_ID', value: clientId, description: 'Zoho OAuth API Client ID' },
                { key: 'ZOHO_CLIENT_SECRET', value: clientSecret, description: 'Zoho OAuth API Client Secret' },
                { key: 'ZOHO_REFRESH_TOKEN', value: refreshToken, description: 'Zoho OAuth API Permanent Refresh Token' }
            ], { onConflict: 'key' });
        } catch (saveErr) {
            console.warn("Auto-backfill system_secrets note:", saveErr);
        }

        // 2. Fetch Zoho OAuth Access Token
        console.log("[create-zoho-user] Requesting fresh OAuth access token from Zoho...");
        const tokenUrl = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=refresh_token`;
        
        const tokenRes = await fetch(tokenUrl, { method: 'POST' });
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error("[create-zoho-user] Zoho OAuth token error:", tokenData);
            return new Response(JSON.stringify({
                success: false,
                error: tokenData.error || "Failed to obtain Zoho OAuth access token",
                corporateEmail: targetEmail
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const accessToken = tokenData.access_token;

        // 3. Create User in Zoho Organization Mail via API (Endpoint: /accounts)
        console.log(`[create-zoho-user] Provisioning user ${targetEmail} directly in Zoho Org (${orgId})...`);
        const createRes = await fetch(`https://mail.zoho.com/api/organization/${orgId}/accounts`, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                primaryEmailAddress: targetEmail,
                password: password || 'Password123!',
                firstName,
                lastName,
                displayName: fullName.trim()
            })
        });

        const createResult = await createRes.json();
        console.log("[create-zoho-user] Zoho User creation result:", createResult);

        return new Response(JSON.stringify({
            success: true,
            message: "User created directly in Zoho Organization Mail!",
            createResult,
            corporateEmail: targetEmail
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("[create-zoho-user Error]:", error);
        return new Response(JSON.stringify({ error: error.message || "Zoho account creation failed" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

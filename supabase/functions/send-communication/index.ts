
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, recipient, recipient_mode, subject, body } = payload;
    const mode = recipient_mode || 'single';

    if (type !== 'email' && type !== 'sms') {
         return new Response(JSON.stringify({ message: `Channel ${type} not supported yet` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    // Check secrets
    const zohoEmail = Deno.env.get("ZOHO_EMAIL");
    const zohoPassword = Deno.env.get("ZOHO_PASSWORD");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!zohoEmail || !zohoPassword) {
      throw new Error("Missing email credentials");
    }

    const emailSubject = subject || "Notification from Abu Mafhal Hub";
    let recipients: string[] = [];

    // --- RECIPIENT LOGIC ---
    if (mode === 'single') {
        if (!recipient) throw new Error("Missing 'recipient' for single mode");
        recipients = [recipient];
    } 
    else if (mode === 'all' || mode === 'admins') {
        if (!supabaseServiceKey) throw new Error("Missing service role key for broadcast");
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch all users from Auth (limit to 1000 for safety in this iteration)
        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (authError || !users) throw authError || new Error("No users found");

        let targetUsers = users;

        // 2. Filter for Admins if needed
        if (mode === 'admins') {
            // Get IDs of admins from profiles
            const { data: adminProfiles, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .in('role', ['admin', 'super_admin']);
            
            if (profileError) throw profileError;
            
            const adminIds = new Set((adminProfiles || []).map(p => p.id));
            targetUsers = users.filter(u => adminIds.has(u.id));
        }

        // 3. Extract correct contact info based on channel
        if (type === 'email') {
             recipients = targetUsers.map(u => u.email).filter((email): email is string => !!email);
        } else if (type === 'sms') {
             recipients = targetUsers.map(u => u.phone).filter((phone): phone is string => !!phone);
        }
    }

    console.log(`Sending ${type} to ${recipients.length} recipients (Mode: ${mode})`);

    // --- SENDING LOGIC ---
    const results = [];
    const termiiApiKey = Deno.env.get("TERMII_API_KEY");
    if (type === 'sms' && !termiiApiKey) throw new Error("Missing TERMII_API_KEY");

    for (const contact of recipients) {
        try {
            if (type === 'email') {
                const personalizedBody = body.replace(/{{name}}/g, "User"); 
                await sendEmail(
                    contact,
                    emailSubject,
                    "Please view this email in a HTML compatible client.",
                    personalizedBody
                );
            } else if (type === 'sms') {
                // Normalize Phone: 080... -> 23480...
                let formattedContact = contact.replace(/\s/g, ''); // Remove spaces
                if (formattedContact.startsWith('0')) {
                    formattedContact = '234' + formattedContact.substring(1);
                }
                // If it doesn't start with 234 and is not +234, assume it might need handling or is already intl
                if (formattedContact.startsWith('+')) {
                    formattedContact = formattedContact.substring(1);
                }

                // Termii SMS Send
                const smsBody = {
                    api_key: termiiApiKey,
                    to: formattedContact,
                    from: "AbuMafhal", // Updated to match your expected ID
                    sms: body,
                    type: "plain",
                    channel: "generic" 
                };

                console.log(`Sending SMS to ${formattedContact}...`);
                console.log(`Payload: ${JSON.stringify(smsBody)}`);

                const termiiRes = await fetch("https://v3.api.termii.com/api/sms/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(smsBody)
                });
                
                const termiiData = await termiiRes.json();
                console.log("Termii Response:", JSON.stringify(termiiData));

                if (!termiiRes.ok || (termiiData.code && termiiData.code !== "ok")) {
                     throw new Error(termiiData.message || "Termii Error");
                }
            }

            results.push({ contact, status: 'sent' });
            // Small delay to be polite
            await new Promise(r => setTimeout(r, 200)); 
        } catch (e) {
            console.error(`Failed to send to ${contact}:`, e);
            results.push({ contact, status: 'failed', error: String(e) });
        }
    }

    return new Response(JSON.stringify({ 
        message: `Processed ${recipients.length} emails`, 
        success: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Function Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

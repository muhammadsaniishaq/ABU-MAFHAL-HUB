
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

    if (type !== 'email' && type !== 'sms' && type !== 'push') {
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

    const emailSubject = subject || "Notification from Abu Mafhal Sub";
    let recipients: string[] = [];

    // --- RECIPIENT LOGIC ---
    let pushRecipients: { id: string, token: string | null }[] = [];

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (mode === 'single') {
        if (!recipient) throw new Error("Missing 'recipient' for single mode");
        
        if (type === 'push') {
             // Fetch token for this single user (assuming recipient is user_id)
            const { data: profile, error: _error } = await supabaseAdmin
                .from('profiles')
                .select('id, expo_push_token')
                .eq('id', recipient)
                .single();
            
            // Allow sending even if no token, so at least In-App Realtime notification works!
            if (profile) pushRecipients = [{ id: profile.id, token: profile.expo_push_token }];

        } else {
            recipients = [recipient];
        }
    } 
    else if (mode === 'all' || mode === 'admins') {
        
        if (type === 'push') {
            // Fetch id and tokens from profiles
            let query = supabaseAdmin.from('profiles').select('id, expo_push_token');
            
            if (mode === 'admins') {
                query = query.in('role', ['admin', 'super_admin']);
            }

            const { data: profiles, error } = await query;
            if (error) throw error;

            // Map to objects
            pushRecipients = profiles.map(p => ({ id: p.id, token: p.expo_push_token }));

        } else {
            // Existing Logic for Email/SMS (using Auth)
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
    }

    // --- TEMPLATE HELPER ---
    const generateHtmlEmail = (bodyContent: string, title: string, logoUrl: string | null) => {
        const currentYear = new Date().getFullYear();
        
        // Use the fetched logo, or a simple text AM if it fails
        const finalLogo = logoUrl 
            ? `<img src="${logoUrl}" alt="Abu Mafhal Sub" width="36" height="36" style="display:block; border-radius:6px; border:1px solid #D9A73A;" />`
            : `<table cellpadding="0" cellspacing="0" style="background-color:#D9A73A; border-radius:6px; width:36px; height:36px; text-align:center;"><tr><td style="vertical-align:middle; text-align:center; color:#ffffff; font-size:16px; font-weight:bold; font-family:Arial,sans-serif; height:36px;">AM</td></tr></table>`;

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#F4F7FA;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;-webkit-font-smoothing:antialiased;">
          <!-- OUTER WRAPPER WITH NAVY TOP BANNER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7FA; padding-bottom:40px;">
            <tr>
              <td align="center" style="background-color:#0E1A2E; height:120px; vertical-align:top; padding-top:30px;">
                <!-- FLOATING HEADER -->
                <table width="460" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td align="center">
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="padding-right:12px;">
                            ${finalLogo}
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="font-size:20px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">Abu Mafhal Sub</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="margin-top:-40px;">
                <!-- FLOATING WHITE CARD -->
                <table width="460" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; box-shadow:0 10px 30px rgba(14,26,46,0.1); margin-top:-40px; border-top:4px solid #D9A73A;">
                  <tr>
                    <td style="padding:30px; text-align:left;">
                      <h2 style="margin:0 0 15px 0; font-size:18px; font-weight:700; color:#0E1A2E;">${title}</h2>
                      <div style="font-size:14px; color:#475569; line-height:1.7;">
                        ${bodyContent.replace(/\n/g, '<br/>')}
                      </div>
                    </td>
                  </tr>
                  <!-- MODERN FOOTER INSIDE CARD -->
                  <tr>
                    <td style="padding:20px 30px; background-color:#FAFCFF; border-top:1px solid #F1F5F9; border-bottom-left-radius:12px; border-bottom-right-radius:12px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="text-align:center;">
                            <p style="margin:0; font-size:12px; color:#64748b; font-weight:500;">&copy; ${currentYear} Abu Mafhal Sub. All rights reserved.</p>
                            <p style="margin:6px 0 0; font-size:11px; color:#94A3B8;">This is an automated notification. Please do not reply directly to this email.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        `;
    };

    console.log(`Sending ${type} to ${type === 'push' ? pushRecipients.length : recipients.length} recipients (Mode: ${mode})`);

    // --- SENDING LOGIC ---
    const results = [];
    const termiiApiKey = Deno.env.get("TERMII_API_KEY");
    if (type === 'sms' && !termiiApiKey) throw new Error("Missing TERMII_API_KEY");

    if (type === 'push') {
        // Special loop for Push Objects
        for (const user of pushRecipients) {
            try {
                // 1. Insert into Notifications Table (Realtime Workaround + History)
                const { error: dbError } = await supabaseAdmin
                    .from('notifications')
                    .insert({
                        user_id: user.id,
                        title: subject || 'Abu Mafhal Sub',
                        body: body,
                        data: {},
                        created_at: new Date().toISOString()
                    });
                
                if (dbError) console.error(`DB Insert failed for ${user.id}:`, dbError);

                // 2. Send Remote Push (if token exists)
                if (user.token && user.token.startsWith('ExponentPushToken[')) {
                    const message = {
                        to: user.token,
                        sound: 'default',
                        title: subject || 'Abu Mafhal Sub',
                        body: body,
                        data: { someData: 'goes here' },
                    };

                    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    });
                    
                    if (!expoRes.ok) console.warn("Expo Push Failed for token", user.token);
                }

                results.push({ contact: user.id, status: 'sent' });

            } catch (e) {
                 console.error(`Failed to push to ${user.id}:`, e);
                 results.push({ contact: user.id, status: 'failed', error: String(e) });
            }
        }
    } else {
        // Standard Loop for Email/SMS strings
        for (const contact of recipients) {
            try {
                if (type === 'email') {
                    let dynamicLogo = "https://lh3.googleusercontent.com/msqhVq_JQ6x04b9_cy87eDN3tXjT8lzXUkT_PwdVpVQWjODAAakIC0mw_G3mnOjiXT9dTkuNv6ZGSg6O=s265-w265-h265";
                    try {
                        const { data: setting } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'app_logo_icon').single();
                        if (setting && setting.value && setting.value.url) {
                            // If the URL is a local dev URL, it will fail in real emails, so keep the fallback
                            if (!setting.value.url.includes('127.0.0.1') && !setting.value.url.includes('localhost')) {
                                dynamicLogo = setting.value.url;
                            }
                        }
                    } catch (err) {
                        console.log("Could not fetch logo", err);
                    }

                    const personalizedBody = body.replace(/{{name}}/g, "User"); 
                    const htmlContent = generateHtmlEmail(personalizedBody, emailSubject, dynamicLogo);
                    
                    await sendEmail(
                        contact,
                        emailSubject,
                        "Please view this email in a HTML compatible client.",
                        htmlContent // Sending the templated HTML
                    );
                } else if (type === 'sms') {
                    // Normalize Phone: 080... -> 23480...
                    let formattedContact = contact.replace(/\s/g, ''); // Remove spaces
                    if (formattedContact.startsWith('0')) {
                        formattedContact = '234' + formattedContact.substring(1);
                    }
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

                    const termiiRes = await fetch("https://v3.api.termii.com/api/sms/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(smsBody)
                    });
                    
                    const termiiData = await termiiRes.json();
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

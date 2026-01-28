
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

    const emailSubject = subject || "Notification from Abu Mafhal Hub";
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
    const generateHtmlEmail = (bodyContent: string, title: string) => {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.1);max-width:92%;border:1px solid #e2e8f0;">
                  <!-- HEADER -->
                  <tr>
                    <td align="center" style="background:linear-gradient(135deg,#4F46E5,#6366F1);padding:45px 20px;">
                      <!-- Logo Placeholder - You can replace src with your actual logo URL -->
                      <div style="width:64px;height:64px;background:#ffffff;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:15px;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                         <span style="font-size:32px;">🦅</span>
                      </div>
                      <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">ABU MAFHAL HUB</h1>
                      <p style="margin:8px 0 0;font-size:13px;color:#e0e7ff;font-weight:500;letter-spacing:0.5px;">Premium Services • Unmatched Quality</p>
                    </td>
                  </tr>
                  <!-- BODY -->
                  <tr>
                    <td style="padding:40px 35px;background-color:#ffffff;">
                      <h2 style="margin:0 0 25px;font-size:22px;font-weight:700;color:#1e293b;text-align:center;">${title}</h2>
                      <div style="font-size:16px;line-height:1.7;color:#475569;">
                        ${bodyContent.replace(/\n/g, '<br/>')}
                      </div>
                      <div style="margin-top:45px;text-align:center;">
                        <a href="https://abumafhal.com" style="display:inline-block;padding:14px 35px;background:#4F46E5;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;box-shadow:0 4px 12px rgba(79, 70, 229, 0.4);transition:all 0.3s ease;">Open App</a>
                      </div>
                    </td>
                  </tr>
                  <!-- SOCIAL MEDIA & FOOTER -->
                  <tr>
                    <td align="center" style="background:#f8fafc;padding:30px;border-top:1px solid #e2e8f0;">
                      
                      <!-- Social Icons -->
                      <div style="margin-bottom:25px;">
                        <a href="https://facebook.com" style="margin:0 10px;text-decoration:none;display:inline-block;">
                          <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="24" height="24" alt="Facebook" style="opacity:0.6;">
                        </a>
                        <a href="https://twitter.com" style="margin:0 10px;text-decoration:none;display:inline-block;">
                          <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="24" height="24" alt="Twitter" style="opacity:0.6;">
                        </a>
                        <a href="https://instagram.com" style="margin:0 10px;text-decoration:none;display:inline-block;">
                          <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="24" height="24" alt="Instagram" style="opacity:0.6;">
                        </a>
                         <a href="https://whatsapp.com" style="margin:0 10px;text-decoration:none;display:inline-block;">
                          <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" width="24" height="24" alt="WhatsApp" style="opacity:0.6;">
                        </a>
                      </div>

                      <p style="margin:0;font-size:12px;color:#94a3b8;font-weight:500;">© ${new Date().getFullYear()} Abu Mafhal Hub. All rights reserved.</p>
                      <p style="margin:8px 0 0;font-size:12px;color:#cbd5e1;">Gashua, Yobe State, Nigeria</p>
                      
                      <div style="margin-top:15px;">
                        <a href="#" style="font-size:11px;color:#94a3b8;text-decoration:underline;margin:0 8px;">Privacy Policy</a>
                        <a href="#" style="font-size:11px;color:#94a3b8;text-decoration:underline;margin:0 8px;">Terms of Service</a>
                      </div>
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
                        title: subject || 'Abu Mafhal Hub',
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
                        title: subject || 'Abu Mafhal Hub',
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
                    const personalizedBody = body.replace(/{{name}}/g, "User"); 
                    const htmlContent = generateHtmlEmail(personalizedBody, emailSubject);
                    
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


import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";
import { renderAbuMafhalEmailTemplate } from "../_shared/email-template.ts";

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
    const { type, recipient, recipient_mode, subject, body, actionRoute, priority } = payload;
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
        return renderAbuMafhalEmailTemplate({
            recipientName: 'Valued Customer',
            headlineBadge: 'Official Update',
            headlineTitle: title,
            headlineSubtitle: 'Fast, secure and affordable digital services in one app.',
            greeting: `Hello 👋`,
            messageBody: bodyContent.replace(/\n/g, '<br/>'),
            buttonText: 'Open ABU MAFHAL SUB &rarr;',
            buttonUrl: 'https://abumafhal.com.ng'
        });
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
                const hasValidToken = typeof user.token === 'string' && (
                    user.token.startsWith('ExponentPushToken[') ||
                    user.token.startsWith('ExpoPushToken[') ||
                    user.token.includes('ExponentPushToken') ||
                    user.token.includes('ExpoPushToken') ||
                    user.token.length > 20
                );

                if (user.token && hasValidToken) {
                    const message = {
                        to: user.token,
                        sound: 'default',
                        title: subject || 'Abu Mafhal Sub',
                        body: body,
                        channelId: priority === 'high' ? 'security' : 'transactions',
                        priority: 'high',
                        data: {
                            route: actionRoute || '/(app)/history',
                            priority: priority || 'normal'
                        },
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
                    
                    if (!expoRes.ok) {
                        const errTxt = await expoRes.text();
                        console.warn("Expo Push Failed for token", user.token, errTxt);
                    } else {
                        console.log("Expo Push Sent Successfully to token:", user.token);
                    }
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
                        from: "ABUMAFHAL",
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

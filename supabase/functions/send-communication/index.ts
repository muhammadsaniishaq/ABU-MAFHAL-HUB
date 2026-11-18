import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";
import { renderAbuMafhalEmailTemplate } from "../_shared/email-template.ts";
import { verifyAdminCaller } from "../_shared/admin-auth.ts";
import { getSystemSecrets } from "../_shared/secrets.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toInternationalPhone(phone: string): string {
    let cleaned = (phone || '').replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        return '234' + cleaned.slice(1);
    }
    if (cleaned.startsWith('234') && cleaned.length === 13) {
        return cleaned;
    }
    if (cleaned.length === 10) {
        return '234' + cleaned;
    }
    return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { 
        type, 
        recipient, 
        recipient_mode, 
        subject, 
        body, 
        actionRoute, 
        priority, 
        version,
        url: customUrl,
        playStoreUrl,
        apkUrl 
    } = payload;
    const mode = recipient_mode || 'single';

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 🛡️ CRITICAL SECURITY SHIELD: Restrict Broadcast/All Mode to Authenticated Admin
    if (mode === 'all' || mode === 'admins' || mode === 'broadcast') {
        const adminCheck = await verifyAdminCaller(req, supabaseAdmin);
        if (!adminCheck.isAdmin) {
            console.warn(`[send-communication] Unauthorized broadcast attempt blocked: ${adminCheck.error}`);
            return new Response(JSON.stringify({ 
                error: adminCheck.error || "Access denied: Admin privileges required for broadcast messaging." 
            }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }

    if (type !== 'email' && type !== 'sms' && type !== 'push' && type !== 'whatsapp') {
         return new Response(JSON.stringify({ error: `Channel ${type} not supported` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    const emailSubject = subject || "Notification from Abu Mafhal Sub";

    // =========================================================================
    // CHANNEL: WHATSAPP (Direct Meta Cloud API & Fallbacks)
    // =========================================================================
    if (type === 'whatsapp') {
        const secrets = await getSystemSecrets([
            'WHATSAPP_PHONE_NUMBER_ID',
            'WHATSAPP_ACCESS_TOKEN',
            'WHATSAPP_BOT_NUMBER',
            'BIGI_API_TOKEN',
            'BIGI_API_PIN',
            'BIGIHUB_BASE_URL'
        ]);

        const phoneId = secrets['WHATSAPP_PHONE_NUMBER_ID'] || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
        const accessToken = secrets['WHATSAPP_ACCESS_TOKEN'] || Deno.env.get('WHATSAPP_ACCESS_TOKEN');

        if (!phoneId || !accessToken) {
            console.warn("[send-communication] Missing WhatsApp Meta Credentials in system_secrets or environment.");
        }

        // 1. Gather WhatsApp Target Recipients
        const targets: { id: string; name: string; phone: string }[] = [];
        const seenNumbers = new Set<string>();

        if (mode === 'single') {
            if (!recipient) throw new Error("Missing 'recipient' phone number for single mode");
            const intl = toInternationalPhone(recipient);
            if (intl) targets.push({ id: '', name: 'Valued Customer', phone: intl });
        } else {
            let query = supabaseAdmin
                .from('profiles')
                .select('id, full_name, phone, whatsapp_number');

            if (mode === 'admins') {
                query = query.in('role', ['admin', 'super_admin']);
            }

            const { data: userProfiles, error: fetchErr } = await query;
            if (fetchErr) throw fetchErr;

            for (const p of userProfiles || []) {
                const raw = p.whatsapp_number || p.phone;
                if (!raw) continue;
                const intl = toInternationalPhone(raw);
                if (intl && intl.length >= 10 && !seenNumbers.has(intl)) {
                    seenNumbers.add(intl);
                    targets.push({
                        id: p.id,
                        name: p.full_name || 'Valued Customer',
                        phone: intl
                    });
                }
            }
        }

        console.log(`[send-communication] Dispatching WhatsApp update broadcast to ${targets.length} recipients...`);

        let sentSuccess = 0;
        let sentFailed = 0;
        const targetUrl = playStoreUrl || customUrl || 'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

        for (const user of targets) {
            try {
                // Personalize body
                const userMsg = (body || '')
                    .replace(/{{name}}/g, user.name)
                    .replace(/{{version}}/g, version || 'Latest')
                    .replace(/{{phone}}/g, user.phone);

                let delivered = false;

                // Attempt Direct Meta WhatsApp Cloud API Text
                if (phoneId && accessToken) {
                    try {
                        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                recipient_type: 'individual',
                                to: user.phone,
                                type: 'text',
                                text: { body: userMsg }
                            })
                        });

                        const metaData = await metaRes.json().catch(() => null);
                        if (metaRes.ok && metaData?.messages?.[0]?.id) {
                            delivered = true;
                        } else {
                            console.warn(`[send-communication] WhatsApp send notice for ${user.phone}:`, metaRes.status, metaData?.error?.message);
                        }
                    } catch (metaErr) {
                        console.warn(`[send-communication] WhatsApp fetch exception for ${user.phone}:`, metaErr);
                    }
                }

                // If Meta direct send failed or credentials missing, attempt fallback SMS
                if (!delivered && secrets['BIGI_API_TOKEN']) {
                    try {
                        const localNumber = user.phone.startsWith('234') ? '0' + user.phone.slice(3) : user.phone;
                        const smsBaseUrl = secrets['BIGIHUB_BASE_URL'] || 'https://bigisub.com/api';
                        const smsText = `Abu Mafhal Sub v${version || 'New'}: An fitar da sabon update! Danna nan domin sabuntawa: ${targetUrl}`;

                        await fetch(`${smsBaseUrl}/sms/`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Token ${secrets['BIGI_API_TOKEN']}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                recipient: localNumber,
                                sender: 'ABUMAFHAL',
                                message: smsText.slice(0, 160),
                                pin: secrets['BIGI_API_PIN'] || '1234'
                            })
                        }).catch(() => {});
                    } catch (_) {}
                }

                // Insert In-App Notification Record for user
                if (user.id) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: user.id,
                        title: subject || `⚡ New Abu Mafhal Sub Update v${version || ''}!`,
                        body: userMsg.slice(0, 500),
                        data: {
                            type: 'app_update',
                            version: version || '',
                            url: targetUrl,
                            route: targetUrl
                        },
                        created_at: new Date().toISOString()
                    }).catch(() => {});
                }

                sentSuccess++;
                // Polite pace
                await new Promise(r => setTimeout(r, 60));
            } catch (err) {
                console.error(`[send-communication] Failed for ${user.phone}:`, err);
                sentFailed++;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            channel: 'whatsapp',
            total: targets.length,
            sent: sentSuccess,
            failed: sentFailed,
            message: `WhatsApp broadcast processed for ${sentSuccess} recipients.`
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    // =========================================================================
    // CHANNEL: PUSH NOTIFICATIONS
    // =========================================================================
    if (type === 'push') {
        let pushRecipients: { id: string, token: string | null }[] = [];

        if (mode === 'single') {
            if (!recipient) throw new Error("Missing 'recipient' for single mode");
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id, expo_push_token')
                .eq('id', recipient)
                .single();
            if (profile) pushRecipients = [{ id: profile.id, token: profile.expo_push_token }];
        } else {
            let query = supabaseAdmin.from('profiles').select('id, expo_push_token');
            if (mode === 'admins') {
                query = query.in('role', ['admin', 'super_admin']);
            }
            const { data: profiles, error } = await query;
            if (error) throw error;
            pushRecipients = (profiles || []).map(p => ({ id: p.id, token: p.expo_push_token }));
        }

        console.log(`Sending push to ${pushRecipients.length} recipients (Mode: ${mode})`);
        const results = [];

        for (const user of pushRecipients) {
            try {
                // 1. Insert into Notifications Table
                await supabaseAdmin
                    .from('notifications')
                    .insert({
                        user_id: user.id,
                        title: subject || 'Abu Mafhal Sub',
                        body: body,
                        data: {
                            url: customUrl || actionRoute || '',
                            route: actionRoute || '',
                            type: payload.type_tag || 'app_update',
                            priority: priority || 'high'
                        },
                        created_at: new Date().toISOString()
                    });

                // 2. Send Remote Push if valid token
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
                            url: customUrl || actionRoute || '',
                            route: actionRoute || '',
                            type: payload.type_tag || 'app_update',
                            priority: priority || 'normal'
                        },
                    };

                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    }).catch(() => {});
                }

                results.push({ contact: user.id, status: 'sent' });
            } catch (e) {
                 results.push({ contact: user.id, status: 'failed', error: String(e) });
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            channel: 'push',
            total: pushRecipients.length,
            sent: results.filter(r => r.status === 'sent').length
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    // =========================================================================
    // CHANNELS: EMAIL & SMS
    // =========================================================================
    let recipients: string[] = [];

    if (mode === 'single') {
        if (!recipient) throw new Error("Missing 'recipient' for single mode");
        recipients = [recipient];
    } else {
        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (authError || !users) throw authError || new Error("No users found");

        let targetUsers = users;
        if (mode === 'admins') {
            const { data: adminProfiles, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .in('role', ['admin', 'super_admin']);
            if (profileError) throw profileError;
            const adminIds = new Set((adminProfiles || []).map(p => p.id));
            targetUsers = users.filter(u => adminIds.has(u.id));
        }

        if (type === 'email') {
            recipients = targetUsers.map(u => u.email).filter((e): e is string => !!e);
        } else if (type === 'sms') {
            recipients = targetUsers.map(u => u.phone).filter((p): p is string => !!p);
        }
    }

    const termiiApiKey = Deno.env.get("TERMII_API_KEY");
    if (type === 'sms' && !termiiApiKey) throw new Error("Missing TERMII_API_KEY");

    const results = [];
    for (const contact of recipients) {
        try {
            if (type === 'email') {
                const dynamicLogo = "https://lh3.googleusercontent.com/msqhVq_JQ6x04b9_cy87eDN3tXjT8lzXUkT_PwdVpVQWjODAAakIC0mw_G3mnOjiXT9dTkuNv6ZGSg6O=s265-w265-h265";
                const personalizedBody = body.replace(/{{name}}/g, "Valued Customer"); 
                const htmlContent = renderAbuMafhalEmailTemplate({
                    recipientName: 'Valued Customer',
                    headlineBadge: 'Official Update',
                    headlineTitle: emailSubject,
                    headlineSubtitle: 'Fast, secure and affordable digital services in one app.',
                    greeting: `Hello 👋`,
                    messageBody: personalizedBody.replace(/\n/g, '<br/>'),
                    buttonText: 'Open ABU MAFHAL SUB &rarr;',
                    buttonUrl: 'https://abumafhal.com.ng'
                });
                
                await sendEmail(
                    contact,
                    emailSubject,
                    "Please view this email in a HTML compatible client.",
                    htmlContent,
                    supabaseAdmin
                );
            } else if (type === 'sms') {
                let formattedContact = contact.replace(/\s/g, '');
                if (formattedContact.startsWith('0')) formattedContact = '234' + formattedContact.substring(1);
                if (formattedContact.startsWith('+')) formattedContact = formattedContact.substring(1);

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
            await new Promise(r => setTimeout(r, 100)); 
        } catch (e) {
            results.push({ contact, status: 'failed', error: String(e) });
        }
    }

    return new Response(JSON.stringify({ 
        message: `Processed ${recipients.length} recipients`, 
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

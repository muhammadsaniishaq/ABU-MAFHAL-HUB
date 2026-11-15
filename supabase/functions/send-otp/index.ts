import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.1";
import { getSystemSecrets } from "../_shared/secrets.ts";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Normalize Nigerian phone number to international format 23480...
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

// Helper: Format to local 080...
function toLocalPhone(phone: string): string {
    let cleaned = (phone || '').replace(/\D/g, '');
    if (cleaned.startsWith('234') && cleaned.length === 13) {
        return '0' + cleaned.slice(3);
    }
    return cleaned;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { action, identifier, code, channel, purpose = 'profile_completion', userId, name } = body;

        if (!action) {
            return new Response(JSON.stringify({ success: false, message: 'Action is required (send or verify)' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            });
        }

        // ==========================================
        // ACTION: SEND OTP
        // ==========================================
        if (action === 'send') {
            if (!identifier) {
                return new Response(JSON.stringify({ success: false, message: 'Identifier (phone/email/whatsapp) is required' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                });
            }

            const cleanId = identifier.trim().toLowerCase();
            const targetChannel = (channel || (cleanId.includes('@') ? 'email' : 'whatsapp')).toLowerCase();

            // Rate limiting check: Max 4 OTPs sent in the last 10 minutes to same identifier
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const { count: recentCount, error: countError } = await supabaseAdmin
                .from('user_otps')
                .select('*', { count: 'exact', head: true })
                .eq('identifier', cleanId)
                .gte('created_at', tenMinutesAgo);

            if (!countError && (recentCount || 0) >= 4) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: 'Too many OTP requests. Please wait 10 minutes before requesting again.' 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429
                });
            }

            // Generate cryptographically secure 6-digit OTP
            const randomArray = new Uint32Array(1);
            crypto.getRandomValues(randomArray);
            const generatedOtp = String((randomArray[0] % 900000) + 100000);

            // Expiry 10 minutes from now
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            // Invalidate older unverified OTPs for this identifier & purpose
            await supabaseAdmin
                .from('user_otps')
                .delete()
                .eq('identifier', cleanId)
                .eq('purpose', purpose)
                .eq('verified', false);

            // Store new OTP
            const { error: insertError } = await supabaseAdmin
                .from('user_otps')
                .insert({
                    user_id: userId || null,
                    identifier: cleanId,
                    code: generatedOtp,
                    channel: targetChannel,
                    purpose: purpose,
                    verified: false,
                    expires_at: expiresAt
                });

            if (insertError) {
                console.error("[send-otp] Insert error:", insertError);
                return new Response(JSON.stringify({ success: false, message: 'Failed to create OTP record: ' + insertError.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500
                });
            }

            let deliveryResult = { success: false, channel: targetChannel, details: '' };

            // 1. Channel: WHATSAPP
            if (targetChannel === 'whatsapp') {
                const intlPhone = toInternationalPhone(cleanId);
                const secrets = await getSystemSecrets(['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN']);
                const phoneId = secrets['WHATSAPP_PHONE_NUMBER_ID'] || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
                const accessToken = secrets['WHATSAPP_ACCESS_TOKEN'] || Deno.env.get('WHATSAPP_ACCESS_TOKEN');

                if (!phoneId || !accessToken) {
                    console.error("[send-otp] WhatsApp credentials missing in system_secrets");
                    deliveryResult = { success: false, channel: 'whatsapp', details: 'WhatsApp service not configured' };
                } else {
                    const messageBody = `🔒 *ABU MAFHAL SUB*\n\nYour security verification code is:\n\n*${generatedOtp}*\n\n⏰ Valid for 10 minutes.\nDo not disclose this code to anyone for your security.\n\nThank you for choosing Abu Mafhal Sub!`;
                    
                    const waRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            recipient_type: 'individual',
                            to: intlPhone,
                            type: 'text',
                            text: { body: messageBody }
                        })
                    });

                    const waData = await waRes.json().catch(() => null);
                    if (waRes.ok && waData?.messages?.[0]?.id) {
                        deliveryResult = { success: true, channel: 'whatsapp', details: 'Sent via WhatsApp' };
                    } else {
                        console.error("[send-otp] Meta WhatsApp API error:", waRes.status, waData);
                        deliveryResult = { success: false, channel: 'whatsapp', details: waData?.error?.message || 'Failed to send WhatsApp message' };
                    }
                }
            } 
            // 2. Channel: SMS
            else if (targetChannel === 'sms') {
                const localPhone = toLocalPhone(cleanId);
                const secrets = await getSystemSecrets(['BIGI_API_TOKEN', 'BIGI_API_PIN', 'BIGIHUB_BASE_URL']);
                const token = secrets['BIGI_API_TOKEN'];
                const pin = secrets['BIGI_API_PIN'] || '1234';
                const baseUrl = secrets['BIGIHUB_BASE_URL'] || 'https://bigisub.com/api';

                if (!token) {
                    deliveryResult = { success: false, channel: 'sms', details: 'SMS Gateway credentials missing' };
                } else {
                    const smsPayload = {
                        recipient: localPhone,
                        sender: 'ABUMAFHAL',
                        message: `Your Abu Mafhal Sub verification code is: ${generatedOtp}. Valid for 10 minutes. Do not share.`,
                        pin: pin
                    };

                    const smsRes = await fetch(`${baseUrl}/sms/`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(smsPayload)
                    });

                    const smsData = await smsRes.json().catch(() => null);
                    if (smsRes.ok || smsData?.status === 'success') {
                        deliveryResult = { success: true, channel: 'sms', details: 'Sent via SMS' };
                    } else {
                        deliveryResult = { success: false, channel: 'sms', details: smsData?.message || 'SMS delivery failed' };
                    }
                }
            }
            // 3. Channel: EMAIL
            else {
                const emailSubject = `🔐 Abu Mafhal Sub Verification Code: ${generatedOtp}`;
                const emailHtml = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 700;">ABU MAFHAL SUB</h2>
                            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Security & Account Verification</p>
                        </div>
                        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px dashed #cbd5e1;">
                            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit OTP</span>
                            <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #0f172a; margin: 12px 0;">${generatedOtp}</div>
                            <span style="font-size: 12px; color: #e11d48; font-weight: 500;">Valid for 10 minutes</span>
                        </div>
                        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                            Hello ${name || 'Valued User'}, please enter this verification code into the Abu Mafhal Sub application to confirm your identity.
                        </p>
                        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0;">
                            If you did not request this verification code, please ignore this email or contact our support team immediately.
                        </p>
                    </div>
                `;

                const emailRes = await sendEmail(
                    cleanId,
                    emailSubject,
                    `Your Abu Mafhal Sub verification code is: ${generatedOtp}. It expires in 10 minutes.`,
                    emailHtml,
                    supabaseAdmin
                );

                if (emailRes && emailRes.success) {
                    deliveryResult = { success: true, channel: 'email', details: 'Sent via Email' };
                } else {
                    deliveryResult = { success: false, channel: 'email', details: 'Email delivery failed' };
                }
            }

            return new Response(JSON.stringify({
                success: deliveryResult.success,
                channel: targetChannel,
                identifier: cleanId,
                message: deliveryResult.success ? `Verification code sent to ${cleanId}` : deliveryResult.details,
                // Include preview in non-production or for resilient UX fallback
                expiresAt: expiresAt
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // ==========================================
        // ACTION: VERIFY OTP
        // ==========================================
        if (action === 'verify') {
            if (!identifier || !code) {
                return new Response(JSON.stringify({ success: false, message: 'Identifier and OTP code are required' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                });
            }

            const cleanId = identifier.trim().toLowerCase();
            const cleanCode = code.trim();

            // Find matching active OTP
            const nowIso = new Date().toISOString();
            const { data: otps, error: otpError } = await supabaseAdmin
                .from('user_otps')
                .select('*')
                .eq('identifier', cleanId)
                .eq('code', cleanCode)
                .eq('purpose', purpose)
                .eq('verified', false)
                .gte('expires_at', nowIso)
                .order('created_at', { ascending: false })
                .limit(1);

            if (otpError) {
                return new Response(JSON.stringify({ success: false, message: 'Database error: ' + otpError.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500
                });
            }

            if (!otps || otps.length === 0) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: 'Invalid or expired verification code. Please check and try again.' 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                });
            }

            const matchedOtp = otps[0];

            // Mark OTP as verified
            await supabaseAdmin
                .from('user_otps')
                .update({ verified: true })
                .eq('id', matchedOtp.id);

            const activeUserId = userId || matchedOtp.user_id;

            // If user exists, update their profile flags and confirm auth email if applicable
            if (activeUserId) {
                const updatePayload: Record<string, any> = {};
                
                if (matchedOtp.channel === 'whatsapp') {
                    updatePayload.whatsapp_verified = true;
                    updatePayload.whatsapp_number = cleanId;
                } else if (matchedOtp.channel === 'sms' || (!cleanId.includes('@') && matchedOtp.channel !== 'whatsapp')) {
                    updatePayload.phone_verified = true;
                    updatePayload.phone = cleanId;
                }

                if (Object.keys(updatePayload).length > 0) {
                    await supabaseAdmin
                        .from('profiles')
                        .update(updatePayload)
                        .eq('id', activeUserId);
                }

                // If verifying an email, auto-confirm user in Supabase auth
                if (cleanId.includes('@')) {
                    try {
                        await supabaseAdmin.auth.admin.updateUserById(activeUserId, {
                            email_confirm: true
                        });
                    } catch (e) {
                        console.warn("[send-otp] updateUserById email_confirm notice:", e);
                    }
                }
            }

            return new Response(JSON.stringify({
                success: true,
                message: 'Verification successful!',
                identifier: cleanId,
                channel: matchedOtp.channel
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });

    } catch (err: any) {
        console.error("[send-otp] Fatal error:", err);
        return new Response(JSON.stringify({ success: false, message: err.message || 'Internal server error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});

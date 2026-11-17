import nodemailer from "npm:nodemailer@6.9.13";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { renderAbuMafhalEmailTemplate } from "./email-template.ts";

export const sendEmail = async (
    to: string, 
    subject: string, 
    text: string, 
    html?: string,
    supabaseAdmin?: SupabaseClient
) => {
    let resendApiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY");
    let zohoUser = Deno.env.get("ZOHO_EMAIL") || Deno.env.get("ZOHO_SMTP_EMAIL") || Deno.env.get("SMTP_USER") || Deno.env.get("EMAIL_USER");
    let zohoPass = Deno.env.get("ZOHO_PASSWORD") || Deno.env.get("ZOHO_SMTP_PASSWORD") || Deno.env.get("SMTP_PASS") || Deno.env.get("EMAIL_PASS");
    let smtpHost = Deno.env.get("SMTP_HOST") || Deno.env.get("ZOHO_HOST");
    let smtpPort = Deno.env.get("SMTP_PORT") || Deno.env.get("ZOHO_PORT") || "465";
    let senderFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || Deno.env.get("SENDER_EMAIL");
    let brevoApiKey = Deno.env.get("BREVO_API_KEY");

    // 1. Fetch credentials from DB system_secrets and app_settings if supabaseAdmin is provided
    if (supabaseAdmin) {
        try {
            const targetKeys = [
                'RESEND_API_KEY', 'RESEND_KEY', 
                'ZOHO_EMAIL', 'ZOHO_SMTP_EMAIL', 'SMTP_USER', 'EMAIL_USER',
                'ZOHO_PASSWORD', 'ZOHO_SMTP_PASSWORD', 'SMTP_PASS', 'EMAIL_PASS',
                'SMTP_HOST', 'ZOHO_HOST', 'SMTP_PORT', 'ZOHO_PORT',
                'RESEND_FROM_EMAIL', 'SENDER_EMAIL', 'BREVO_API_KEY'
            ];
            const { data: dbSecrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', targetKeys);

            const { data: appSettings } = await supabaseAdmin
                .from('app_settings')
                .select('key, value')
                .in('key', targetKeys);

            const combined = [...(dbSecrets || []), ...(appSettings || [])];
            if (combined.length > 0) {
                const getVal = (k: string) => combined.find(s => s.key === k && s.value && s.value.trim() !== '')?.value?.trim();
                if (!resendApiKey) resendApiKey = getVal('RESEND_API_KEY') || getVal('RESEND_KEY');
                if (!zohoUser) zohoUser = getVal('ZOHO_EMAIL') || getVal('ZOHO_SMTP_EMAIL') || getVal('SMTP_USER') || getVal('EMAIL_USER');
                if (!zohoPass) zohoPass = getVal('ZOHO_PASSWORD') || getVal('ZOHO_SMTP_PASSWORD') || getVal('SMTP_PASS') || getVal('EMAIL_PASS');
                if (getVal('SMTP_HOST') || getVal('ZOHO_HOST')) smtpHost = getVal('SMTP_HOST') || getVal('ZOHO_HOST');
                if (getVal('SMTP_PORT') || getVal('ZOHO_PORT')) smtpPort = getVal('SMTP_PORT') || getVal('ZOHO_PORT') || '465';
                if (!senderFromEmail) senderFromEmail = getVal('RESEND_FROM_EMAIL') || getVal('SENDER_EMAIL');
                if (!brevoApiKey) brevoApiKey = getVal('BREVO_API_KEY');
            }
        } catch (e) {
            console.warn("[sendEmail] DB Secrets lookup warning:", e);
        }
    }

    // Smart Host Resolution: If user is @gmail.com, default to smtp.gmail.com
    if (!smtpHost) {
        if (zohoUser && zohoUser.toLowerCase().includes('@gmail.com')) {
            smtpHost = 'smtp.gmail.com';
        } else {
            smtpHost = 'smtp.zoho.com';
        }
    }

    // Automatically ensure all emails are wrapped in the official Abu Mafhal Sub template
    let finalHtml = html;
    if (!finalHtml || !finalHtml.includes('<!DOCTYPE html>')) {
        finalHtml = renderAbuMafhalEmailTemplate({
            recipientName: 'Valued Partner',
            headlineBadge: 'Official Notification',
            headlineTitle: subject || 'Abu Mafhal Sub Notification',
            headlineSubtitle: 'Fast, secure and affordable digital services in one app.',
            greeting: 'Hello 👋',
            messageBody: (html || text || '').replace(/\n/g, '<br/>'),
            buttonText: 'Open ABU MAFHAL SUB &rarr;',
            buttonUrl: 'https://abumafhal.com.ng'
        });
    }

    let lastSmtpError: string | null = null;

    // METHOD 1: SMTP / Nodemailer (Zoho, Gmail, or Custom Server)
    if (zohoUser && zohoPass) {
        try {
            const senderAddress = `"Abu Mafhal Sub" <${zohoUser.trim()}>`;
            console.log(`[sendEmail] Sending email via SMTP (${smtpHost}:${smtpPort}) from ${senderAddress} to ${to}...`);
            const portNum = parseInt(smtpPort, 10);
            const isSecure = portNum === 465;

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: portNum,
                secure: isSecure,
                auth: {
                    user: zohoUser.trim(),
                    pass: zohoPass.trim(),
                },
                tls: {
                    rejectUnauthorized: false
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });

            const info = await transporter.sendMail({
                from: senderAddress,
                replyTo: zohoUser.trim(),
                to,
                subject,
                text,
                html: finalHtml,
                headers: {
                    'X-Priority': '3',
                    'X-MSMail-Priority': 'Normal',
                    'Importance': 'Normal',
                    'X-Mailer': 'AbuMafhalMailer v2.5',
                    'Auto-Submitted': 'auto-generated'
                }
            });

            console.log("[sendEmail] Email successfully sent via SMTP to %s (ID: %s)", to, info.messageId);
            return { success: true, method: 'SMTP', messageId: info.messageId, info };
        } catch (smtpErr: any) {
            lastSmtpError = smtpErr?.message || String(smtpErr);
            console.error("[sendEmail] SMTP exception (attempting fallback):", lastSmtpError);
        }
    }

    // METHOD 2: Resend HTTP API
    if (resendApiKey) {
        try {
            // Determine best sender address
            let resendFrom = senderFromEmail || (zohoUser && zohoUser.includes('@abumafhal.') ? `Abu Mafhal Sub <${zohoUser.trim()}>` : 'Abu Mafhal Sub <notifications@abumafhal.com.ng>');
            
            console.log(`[sendEmail] Sending email via Resend API from ${resendFrom} to ${to}...`);
            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendApiKey.trim()}`
                },
                body: JSON.stringify({
                    from: resendFrom,
                    to: [to],
                    reply_to: zohoUser ? zohoUser.trim() : undefined,
                    subject,
                    text,
                    html: finalHtml,
                    headers: {
                        'X-Entity-Ref-ID': `${Date.now()}`
                    }
                })
            });

            const resData = await resendRes.json();
            if (resendRes.ok) {
                console.log("[sendEmail] Email successfully sent via Resend API:", resData.id);
                return { success: true, method: 'Resend', id: resData.id, resData };
            } else {
                console.warn("[sendEmail] Resend API error:", resData);
                // If custom sender failed due to domain unverified, try fallback
                if (resData?.message?.includes('domain') || resData?.name === 'validation_error') {
                    console.log("[sendEmail] Retrying Resend with fallback sandbox address...");
                    const retryRes = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${resendApiKey.trim()}`
                        },
                        body: JSON.stringify({
                            from: 'Abu Mafhal Sub <onboarding@resend.dev>',
                            to: [to],
                            subject,
                            text,
                            html: finalHtml
                        })
                    });
                    const retryData = await retryRes.json();
                    if (retryRes.ok) {
                        return { success: true, method: 'Resend-Sandbox', id: retryData.id, retryData };
                    }
                }
            }
        } catch (err: any) {
            console.error("[sendEmail] Resend API exception:", err);
        }
    }

    // METHOD 3: Brevo (Sendinblue) HTTP API
    if (brevoApiKey) {
        try {
            console.log(`[sendEmail] Sending email via Brevo HTTP API to ${to}...`);
            const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey.trim()
                },
                body: JSON.stringify({
                    sender: { name: 'Abu Mafhal Sub', email: zohoUser || 'support@abumafhal.com.ng' },
                    to: [{ email: to }],
                    subject,
                    textContent: text,
                    htmlContent: finalHtml
                })
            });

            const brevoData = await brevoRes.json();
            if (brevoRes.ok) {
                console.log("[sendEmail] Email successfully sent via Brevo API:", brevoData.messageId);
                return { success: true, method: 'Brevo', messageId: brevoData.messageId };
            } else {
                console.warn("[sendEmail] Brevo API error:", brevoData);
            }
        } catch (bErr) {
            console.error("[sendEmail] Brevo exception:", bErr);
        }
    }

    if (lastSmtpError) {
        return { 
            success: false, 
            error: `SMTP Error: ${lastSmtpError}. Please verify your SMTP credentials (ZOHO_PASSWORD or App Password) in Admin Settings.` 
        };
    }

    console.warn("[sendEmail] No working email credentials found. Please configure ZOHO_EMAIL/ZOHO_PASSWORD or RESEND_API_KEY in Admin Settings -> API Vault.");
    return { 
        success: false, 
        error: "Email delivery failed: Please configure working SMTP credentials (ZOHO_EMAIL & App Password) or RESEND_API_KEY in Admin Settings -> API Vault." 
    };
};

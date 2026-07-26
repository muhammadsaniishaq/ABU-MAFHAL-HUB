
import nodemailer from "nodemailer";
import { SupabaseClient } from "@supabase/supabase-js";

export const sendEmail = async (
    to: string, 
    subject: string, 
    text: string, 
    html?: string,
    supabaseAdmin?: SupabaseClient
) => {
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    let zohoUser = Deno.env.get("ZOHO_EMAIL") || Deno.env.get("SMTP_USER");
    let zohoPass = Deno.env.get("ZOHO_PASSWORD") || Deno.env.get("SMTP_PASS");
    let smtpHost = Deno.env.get("SMTP_HOST") || "smtp.zoho.com";
    let smtpPort = Deno.env.get("SMTP_PORT") || "465";

    // 1. Fetch credentials from DB system_secrets if supabaseAdmin is provided
    if (supabaseAdmin) {
        try {
            const { data: dbSecrets } = await supabaseAdmin
                .from('system_secrets')
                .select('key, value')
                .in('key', ['RESEND_API_KEY', 'ZOHO_EMAIL', 'ZOHO_PASSWORD', 'SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT']);

            if (dbSecrets && dbSecrets.length > 0) {
                const getVal = (k: string) => dbSecrets.find(s => s.key === k)?.value?.trim();
                if (!resendApiKey) resendApiKey = getVal('RESEND_API_KEY');
                if (!zohoUser) zohoUser = getVal('ZOHO_EMAIL') || getVal('SMTP_USER');
                if (!zohoPass) zohoPass = getVal('ZOHO_PASSWORD') || getVal('SMTP_PASS');
                if (getVal('SMTP_HOST')) smtpHost = getVal('SMTP_HOST')!;
                if (getVal('SMTP_PORT')) smtpPort = getVal('SMTP_PORT')!;
            }
        } catch (e) {
            console.warn("[sendEmail] DB Secrets lookup warning:", e);
        }
    }

    // METHOD 1: Resend HTTP API (Fastest & 100% reliable in Edge Functions)
    if (resendApiKey) {
        try {
            console.log(`[sendEmail] Sending email via Resend API to ${to}...`);
            const resendRes = await fetch('https://api.resend.com/emails', {
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
                    html: html || text
                })
            });

            const resData = await resendRes.json();
            if (resendRes.ok) {
                console.log("[sendEmail] Email successfully sent via Resend API:", resData.id);
                return resData;
            } else {
                console.warn("[sendEmail] Resend API warning:", resData);
            }
        } catch (err) {
            console.error("[sendEmail] Resend API exception:", err);
        }
    }

    // METHOD 2: SMTP / Nodemailer (Zoho, Google, Custom SMTP)
    if (zohoUser && zohoPass) {
        try {
            console.log(`[sendEmail] Sending email via SMTP (${smtpHost}) to ${to}...`);
            const portNum = parseInt(smtpPort, 10);
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: portNum,
                secure: portNum === 465,
                auth: {
                    user: zohoUser.trim(),
                    pass: zohoPass.trim(),
                },
            });

            const info = await transporter.sendMail({
                from: `Abu Mafhal Sub <${zohoUser.trim()}>`,
                to,
                subject,
                text,
                html,
            });

            console.log("[sendEmail] Email successfully sent via SMTP to %s (ID: %s)", to, info.messageId);
            return info;
        } catch (smtpErr) {
            console.error("[sendEmail] SMTP exception:", smtpErr);
        }
    }

    console.warn("[sendEmail] No working email credentials found. Please configure RESEND_API_KEY or ZOHO_EMAIL/ZOHO_PASSWORD in Admin Settings -> API Vault.");
    return null;
};

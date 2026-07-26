
import nodemailer from "nodemailer";

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    const zohoUser = Deno.env.get("ZOHO_EMAIL") || Deno.env.get("SMTP_USER");
    const zohoPass = Deno.env.get("ZOHO_PASSWORD") || Deno.env.get("SMTP_PASS");

    if (!zohoUser || !zohoPass) {
        console.warn("[sendEmail] Email credentials (ZOHO_EMAIL/ZOHO_PASSWORD) not configured in Deno.env");
        return null;
    }

    const host = Deno.env.get("SMTP_HOST") || "smtp.zoho.com";
    const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user: zohoUser,
            pass: zohoPass,
        },
    });

    const info = await transporter.sendMail({
        from: `Abu Mafhal Sub <${zohoUser}>`,
        to,
        subject,
        text,
        html,
    });

    console.log("[sendEmail] Email successfully sent to %s (ID: %s)", to, info.messageId);
    return info;
};

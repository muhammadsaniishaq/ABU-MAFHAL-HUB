
import nodemailer from "nodemailer";

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: Deno.env.get("ZOHO_EMAIL"),
            pass: Deno.env.get("ZOHO_PASSWORD"),
        },
    });

    const info = await transporter.sendMail({
        from: Deno.env.get("ZOHO_EMAIL"), // sender address
        to, // list of receivers
        subject, // Subject line
        text, // plain text body
        html, // html body
    });

    console.log("Message sent: %s", info.messageId);
    return info;
};

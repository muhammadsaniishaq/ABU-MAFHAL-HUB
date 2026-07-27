import { supabase } from './supabase';

/**
 * Sends an email notification to the user when they create a new support ticket.
 */
export async function sendTicketCreatedEmail(ticketId: string, subject: string, userEmail?: string, userName?: string) {
    try {
        let email = userEmail;
        let name = userName;

        if (!email) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                email = user.email;
                name = user.user_metadata?.full_name || 'Valued Customer';
            }
        }

        if (!email) return;

        const ticketRef = ticketId.split('-')[0].toUpperCase();
        const emailTitle = `🎫 Support Ticket Created: #${ticketRef}`;
        const emailBody = `Sannu ${name || 'Customer'}! 👋\n\nSupport Ticket ɗinka domin: "${subject}" (Ticket ID: #${ticketRef}) ya samu nasarar buɗewa.\n\nMasu agajinmu na Admin za su duba tambayarka da wuri kuma za mu sanar da kai ta email da zarar an amsa!\n\nAbu Mafhal Sub Support Team.`;

        await supabase.functions.invoke('send-communication', {
            body: {
                type: 'email',
                recipient: email,
                recipient_mode: 'single',
                subject: emailTitle,
                body: emailBody
            }
        });
    } catch (e) {
        console.log("[sendTicketCreatedEmail] Error:", e);
    }
}

/**
 * Sends an email notification to the user when an admin replies to their support ticket.
 */
export async function sendAdminReplyEmail(ticketId: string, ticketSubject: string, replyMessage: string, userEmail?: string, userName?: string) {
    try {
        if (!userEmail) return;

        const ticketRef = ticketId.split('-')[0].toUpperCase();
        const cleanMessage = replyMessage.startsWith('[IMAGE]') ? '📷 Admin sent an image/screenshot attachment.' : replyMessage;

        const emailTitle = `💬 New Admin Reply - Ticket #${ticketRef}`;
        const emailBody = `Sannu ${userName || 'Valued Customer'}! 👋\n\nAdmin ya turo maka da sabon amsa akan Support Ticket ɗinka: "${ticketSubject}" (ID: #${ticketRef}).\n\n💬 Sakon Admin:\n"${cleanMessage}"\n\nDa fatan zaka shiga manhajarmu ta Abu Mafhal Sub don duba saƙonka ko kuma sake amsa Admin.\n\nAbu Mafhal Sub Support Desk.`;

        await supabase.functions.invoke('send-communication', {
            body: {
                type: 'email',
                recipient: userEmail,
                recipient_mode: 'single',
                subject: emailTitle,
                body: emailBody
            }
        });
    } catch (e) {
        console.log("[sendAdminReplyEmail] Error:", e);
    }
}

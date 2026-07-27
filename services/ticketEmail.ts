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
        const emailBody = `Sannu ${name || 'Customer'}! 👋\n\nSupport Ticket ɗinka domin: "${subject}" (Ticket ID: #${ticketRef}) ya samu nasarar buɗewa.\n\nMasu agajinmu na Admin za su duba tambayarka da wuri kuma za mu sanar da kai ta email da zarar an amsa!\n\n------------------------------\nAbu Mafhal Sub Support Team`;

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
 * Sends an email notification to the user containing the EXACT content of what the admin replied.
 */
export async function sendAdminReplyEmail(ticketId: string, ticketSubject: string, replyMessage: string, userEmail?: string, userName?: string) {
    try {
        let email = userEmail;
        let name = userName;

        // If email is missing, lookup profile/auth
        if (!email && ticketId) {
            const { data: ticket } = await supabase
                .from('tickets')
                .select('user_id, profiles(email, full_name)')
                .eq('id', ticketId)
                .single();
            if (ticket && (ticket.profiles as any)?.email) {
                email = (ticket.profiles as any).email;
                name = (ticket.profiles as any).full_name || name;
            }
        }

        if (!email) {
            console.warn("[sendAdminReplyEmail] No recipient email found for ticket", ticketId);
            return;
        }

        const ticketRef = ticketId.split('-')[0].toUpperCase();
        const cleanMessage = replyMessage.startsWith('[IMAGE]') 
            ? '📷 Admin sent an image attachment / receipt screenshot.' 
            : replyMessage;

        const emailTitle = `💬 New Admin Reply - Ticket #${ticketRef}`;
        const emailBody = `Sannu ${name || 'Valued Customer'}! 👋\n\nAdmin ya turo maka da sabon amsa dangane da Support Ticket ɗinka: "${ticketSubject}" (ID: #${ticketRef}).\n\n=========================================\n💬 SAKON AMASAR ADMIN (ADMIN'S REPLY):\n\n"${cleanMessage}"\n=========================================\n\nDa fatan za ka shiga manhajarmu ta Abu Mafhal Sub don ci gaba da magana da Admin ko bincika saƙonninka.\n\nNagode,\nAbu Mafhal Sub Support Desk`;

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
        console.log("[sendAdminReplyEmail] Error:", e);
    }
}


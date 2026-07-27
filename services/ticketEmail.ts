import { supabase } from './supabase';

/**
 * Sends an email notification to the user when they create a new support ticket (100% English).
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
        const emailTitle = `🎫 Support Ticket Received: #${ticketRef}`;
        const emailBody = `Hello ${name || 'Valued Customer'}! 👋\n\nYour support ticket regarding "${subject}" (Ticket ID: #${ticketRef}) has been successfully logged.\n\nOur dedicated support agents are actively reviewing your request and will respond as soon as possible. You will receive an instant email notification once an agent replies.\n\nThank you for choosing Abu Mafhal Sub!\n\nBest regards,\nAbu Mafhal Sub Customer Support Team`;

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
 * Sends an email notification to the user containing the EXACT content of what the admin replied (100% English).
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
        const emailBody = `Hello ${name || 'Valued Customer'}! 👋\n\nAn admin agent has just replied to your support ticket regarding: "${ticketSubject}" (Ticket ID: #${ticketRef}).\n\n=========================================\n💬 ADMIN REPLY MESSAGE:\n\n"${cleanMessage}"\n=========================================\n\nYou can log into the Abu Mafhal Sub mobile app anytime to continue chatting with support or review your full transaction history.\n\nThank you,\nAbu Mafhal Sub Customer Support Desk`;

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



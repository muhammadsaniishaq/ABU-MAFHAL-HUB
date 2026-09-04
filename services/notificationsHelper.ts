import { supabase } from './supabase';
import { sendInstantNotification } from '../hooks/usePushNotifications';

/**
 * Creates an in-app notification for the user and immediately triggers 
 * the phone's native notification bar alert with sound and vibration.
 * 
 * @param userId - The ID of the user receiving the notification
 * @param title - The title of the notification (e.g., "Data Purchase Successful")
 * @param body - The detail text of the notification
 * @param category - The category of the notification (e.g., "data", "airtime", "transfer", "bills", "bvn")
 * @param priority - The priority (e.g., "high", "normal")
 * @param data - Any extra JSON data to attach (e.g., { route: "/(app)/history" })
 */
export const createAppNotification = async (
    userId: string,
    title: string,
    body: string,
    category: string = 'general',
    priority: string = 'normal',
    data: any = {}
) => {
    try {
        if (!userId) return { success: false, error: "No userId provided" };

        // 1. Trigger instant status-bar alert with sound & vibration on current device
        const targetChannel = (category === 'security' || priority === 'high') ? 'security' : 'transactions';
        sendInstantNotification(title, body, data, targetChannel).catch(e => {
            console.warn('[createAppNotification] Sound trigger warning:', e);
        });

        // 2. Persist in database for in-app history & realtime broadcasts
        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            title,
            body,
            type: category,
            priority: priority,
            is_read: false,
            data: data
        });

        if (error) {
            console.error("Error creating notification in DB:", error);
            return { success: false, error };
        }

        return { success: true };
    } catch (err) {
        console.error("Exception creating notification:", err);
        return { success: false, error: err };
    }
};


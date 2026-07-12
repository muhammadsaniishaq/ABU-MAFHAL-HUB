import { supabase } from './supabase';

/**
 * Creates an in-app notification for the user.
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
            console.error("Error creating notification:", error);
            return { success: false, error };
        }

        return { success: true };
    } catch (err) {
        console.error("Exception creating notification:", err);
        return { success: false, error: err };
    }
};
